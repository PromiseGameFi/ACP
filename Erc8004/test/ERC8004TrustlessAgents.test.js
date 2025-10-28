const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC8004TrustlessAgents", function () {
    let contract;
    let owner, agent1, agent2, validator;
    let agent1Id, agent2Id;

    beforeEach(async function () {
        [owner, agent1, agent2, validator] = await ethers.getSigners();

        const ERC8004TrustlessAgents = await ethers.getContractFactory("ERC8004TrustlessAgents");
        contract = await ERC8004TrustlessAgents.deploy();
        await contract.waitForDeployment();
    });

    describe("Identity Registry", function () {
        it("Should register a new agent", async function () {
            const metadataURI = "https://example.com/agent1.json";
            
            const tx = await contract.connect(agent1).registerAgent(metadataURI);
            const receipt = await tx.wait();
            
            // Check event emission
            const event = receipt.logs.find(log => log.fragment?.name === "AgentRegistered");
            expect(event).to.not.be.undefined;
            
            agent1Id = await contract.getAgentIdByAddress(agent1.address);
            expect(agent1Id).to.equal(1);
            
            const agentInfo = await contract.getAgent(agent1Id);
            expect(agentInfo.owner).to.equal(agent1.address);
            expect(agentInfo.metadataURI).to.equal(metadataURI);
            expect(agentInfo.isActive).to.be.true;
        });

        it("Should prevent duplicate agent registration", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            
            await expect(
                contract.connect(agent1).registerAgent("https://example.com/agent1-duplicate.json")
            ).to.be.revertedWith("ERC8004: agent already registered for this address");
        });

        it("Should update agent metadata", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            agent1Id = await contract.getAgentIdByAddress(agent1.address);
            
            const newMetadataURI = "https://example.com/agent1-updated.json";
            await contract.connect(agent1).updateAgentMetadata(agent1Id, newMetadataURI);
            
            const agentInfo = await contract.getAgent(agent1Id);
            expect(agentInfo.metadataURI).to.equal(newMetadataURI);
        });

        it("Should deactivate an agent", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            agent1Id = await contract.getAgentIdByAddress(agent1.address);
            
            await contract.connect(agent1).deactivateAgent(agent1Id);
            
            const agentInfo = await contract.getAgent(agent1Id);
            expect(agentInfo.isActive).to.be.false;
        });

        it("Should prevent non-owners from updating metadata", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            agent1Id = await contract.getAgentIdByAddress(agent1.address);
            
            await expect(
                contract.connect(agent2).updateAgentMetadata(agent1Id, "https://example.com/malicious.json")
            ).to.be.revertedWith("ERC8004: caller is not owner nor approved");
        });
    });

    describe("Reputation Registry", function () {
        beforeEach(async function () {
            // Register agents for testing
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            await contract.connect(agent2).registerAgent("https://example.com/agent2.json");
            agent1Id = await contract.getAgentIdByAddress(agent1.address);
            agent2Id = await contract.getAgentIdByAddress(agent2.address);
        });

        it("Should submit feedback", async function () {
            const taskId = "task_123";
            const rating = 85;
            const feedbackURI = "https://example.com/feedback1.json";
            
            const tx = await contract.connect(agent1).submitFeedback(
                agent2.address,
                taskId,
                rating,
                feedbackURI
            );
            const receipt = await tx.wait();
            
            // Check event emission
            const event = receipt.logs.find(log => log.fragment?.name === "FeedbackSubmitted");
            expect(event).to.not.be.undefined;
            
            const feedbackId = await contract.getCurrentFeedbackId();
            const feedback = await contract.getFeedback(feedbackId);
            
            expect(feedback.client).to.equal(agent1.address);
            expect(feedback.server).to.equal(agent2.address);
            expect(feedback.taskId).to.equal(taskId);
            expect(feedback.rating).to.equal(rating);
            expect(feedback.feedbackURI).to.equal(feedbackURI);
        });

        it("Should calculate average rating", async function () {
            // Submit multiple feedback entries
            await contract.connect(agent1).submitFeedback(agent2.address, "task1", 80, "https://example.com/feedback1.json");
            await contract.connect(agent1).submitFeedback(agent2.address, "task2", 90, "https://example.com/feedback2.json");
            
            const averageRating = await contract.getAgentAverageRating(agent2.address);
            expect(averageRating).to.equal(85); // (80 + 90) / 2
        });

        it("Should prevent unregistered agents from submitting feedback", async function () {
            await expect(
                contract.connect(validator).submitFeedback(
                    agent2.address,
                    "task_123",
                    85,
                    "https://example.com/feedback.json"
                )
            ).to.be.revertedWith("ERC8004: caller is not a registered agent");
        });

        it("Should prevent feedback for inactive agents", async function () {
            // Deactivate agent2
            await contract.connect(agent2).deactivateAgent(agent2Id);
            
            await expect(
                contract.connect(agent1).submitFeedback(
                    agent2.address,
                    "task_123",
                    85,
                    "https://example.com/feedback.json"
                )
            ).to.be.revertedWith("ERC8004: server agent is not active");
        });
    });

    describe("Validation Registry", function () {
        beforeEach(async function () {
            // Register agents for testing
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            await contract.connect(validator).registerAgent("https://example.com/validator.json");
        });

        it("Should request validation", async function () {
            const taskId = "task_456";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
            const validationType = "zkTLS";
            
            const tx = await contract.connect(agent1).requestValidation(taskId, dataHash, validationType);
            const receipt = await tx.wait();
            
            // Check event emission
            const event = receipt.logs.find(log => log.fragment?.name === "ValidationRequested");
            expect(event).to.not.be.undefined;
            
            const requestId = await contract.getCurrentValidationId();
            const request = await contract.getValidationRequest(requestId);
            
            expect(request.requester).to.equal(agent1.address);
            expect(request.taskId).to.equal(taskId);
            expect(request.dataHash).to.equal(dataHash);
            expect(request.validationType).to.equal(validationType);
            expect(request.isCompleted).to.be.false;
        });

        it("Should submit validation response", async function () {
            // First request validation
            const taskId = "task_456";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
            await contract.connect(agent1).requestValidation(taskId, dataHash, "zkTLS");
            
            const requestId = await contract.getCurrentValidationId();
            const score = 95;
            const verified = true;
            const proofURI = "https://example.com/proof.json";
            
            const tx = await contract.connect(validator).submitValidationResponse(
                requestId,
                score,
                verified,
                proofURI
            );
            const receipt = await tx.wait();
            
            // Check event emission
            const event = receipt.logs.find(log => log.fragment?.name === "ValidationResponseSubmitted");
            expect(event).to.not.be.undefined;
            
            const response = await contract.getValidationResponse(requestId);
            expect(response.validator).to.equal(validator.address);
            expect(response.score).to.equal(score);
            expect(response.verified).to.equal(verified);
            expect(response.proofURI).to.equal(proofURI);
            
            // Check that request is marked as completed
            const request = await contract.getValidationRequest(requestId);
            expect(request.isCompleted).to.be.true;
        });

        it("Should prevent duplicate validation responses", async function () {
            // Request and respond to validation
            await contract.connect(agent1).requestValidation("task_456", ethers.keccak256(ethers.toUtf8Bytes("test data")), "zkTLS");
            const requestId = await contract.getCurrentValidationId();
            
            await contract.connect(validator).submitValidationResponse(requestId, 95, true, "https://example.com/proof.json");
            
            // Try to submit another response
            await expect(
                contract.connect(validator).submitValidationResponse(requestId, 80, false, "https://example.com/proof2.json")
            ).to.be.revertedWith("ERC8004: validation already completed");
        });
    });

    describe("Security and Access Control", function () {
        it("Should prevent empty metadata URI", async function () {
            await expect(
                contract.connect(agent1).registerAgent("")
            ).to.be.revertedWith("ERC8004: metadata URI cannot be empty");
        });

        it("Should prevent invalid ratings", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            await contract.connect(agent2).registerAgent("https://example.com/agent2.json");
            
            await expect(
                contract.connect(agent1).submitFeedback(agent2.address, "task1", 101, "https://example.com/feedback.json")
            ).to.be.revertedWith("ERC8004: rating must be between 0 and 100");
        });

        it("Should prevent zero data hash in validation", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            
            await expect(
                contract.connect(agent1).requestValidation("task1", ethers.ZeroHash, "zkTLS")
            ).to.be.revertedWith("ERC8004: data hash cannot be zero");
        });
    });

    describe("Utility Functions", function () {
        it("Should check if agent is active", async function () {
            expect(await contract.isActiveAgent(agent1.address)).to.be.false;
            
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            expect(await contract.isActiveAgent(agent1.address)).to.be.true;
            
            const agentId = await contract.getAgentIdByAddress(agent1.address);
            await contract.connect(agent1).deactivateAgent(agentId);
            expect(await contract.isActiveAgent(agent1.address)).to.be.false;
        });

        it("Should return correct counter values", async function () {
            expect(await contract.getCurrentAgentId()).to.equal(0);
            expect(await contract.getCurrentFeedbackId()).to.equal(0);
            expect(await contract.getCurrentValidationId()).to.equal(0);
            
            // Register agent
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            expect(await contract.getCurrentAgentId()).to.equal(1);
        });
    });

    describe("ERC-721 Compliance", function () {
        it("Should prevent token transfers", async function () {
            await contract.connect(agent1).registerAgent("https://example.com/agent1.json");
            const agentId = await contract.getAgentIdByAddress(agent1.address);
            
            await expect(
                contract.connect(agent1).transferFrom(agent1.address, agent2.address, agentId)
            ).to.be.revertedWith("ERC8004: agent identity tokens are non-transferable");
        });

        it("Should support ERC-721 interfaces", async function () {
            // ERC-721 interface ID
            const ERC721_INTERFACE_ID = "0x80ac58cd";
            expect(await contract.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
        });
    });
});
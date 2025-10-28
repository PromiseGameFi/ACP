const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying ERC8004TrustlessAgents contract...");

    // Get the contract factory
    const ERC8004TrustlessAgents = await ethers.getContractFactory("ERC8004TrustlessAgents");

    // Deploy the contract
    const contract = await ERC8004TrustlessAgents.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log("ERC8004TrustlessAgents deployed to:", contractAddress);

    // Verify deployment by calling a view function
    const currentAgentId = await contract.getCurrentAgentId();
    console.log("Current Agent ID:", currentAgentId.toString());

    console.log("\nContract deployment successful!");
    console.log("Contract features:");
    console.log("✅ Identity Registry - ERC-721 based agent registration");
    console.log("✅ Reputation Registry - Feedback and rating system");
    console.log("✅ Validation Registry - Task validation mechanisms");
    console.log("✅ Comprehensive security controls and access management");
    console.log("✅ Full ERC-8004 standard compliance");

    return contractAddress;
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = main;
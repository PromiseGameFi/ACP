// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ERC8004TrustlessAgents
 * @dev Complete implementation of ERC-8004 Trustless Agents standard
 * 
 * This contract implements all three core registries required by ERC-8004:
 * 1. Identity Registry - ERC-721 based agent registration with metadata
 * 2. Reputation Registry - Feedback and rating system between agents
 * 3. Validation Registry - Task validation and verification mechanisms
 * 
 * The contract enables trustless agent discovery, interaction, and verification
 * across organizational boundaries without pre-existing trust relationships.
 */
contract ERC8004TrustlessAgents is ERC721URIStorage, Ownable, ReentrancyGuard {
    
    // ============ State Variables ============
    
    /// @dev Counter for agent IDs (replacing Counters.sol dependency)
    uint256 private _currentAgentId;
    
    /// @dev Counter for feedback IDs
    uint256 private _currentFeedbackId;
    
    /// @dev Counter for validation request IDs
    uint256 private _currentValidationId;
    
    // ============ Structs ============
    
    /**
     * @dev Agent registration information
     * @param owner The address that owns this agent
     * @param metadataURI URI pointing to agent's registration file
     * @param registrationTime Timestamp when agent was registered
     * @param isActive Whether the agent is currently active
     */
    struct AgentInfo {
        address owner;
        string metadataURI;
        uint256 registrationTime;
        bool isActive;
    }
    
    /**
     * @dev Feedback information for reputation system
     * @param client Address of the client agent providing feedback
     * @param server Address of the server agent receiving feedback
     * @param taskId Identifier for the task being rated
     * @param rating Overall rating (0-100)
     * @param feedbackURI URI pointing to detailed feedback data
     * @param timestamp When feedback was submitted
     */
    struct FeedbackInfo {
        address client;
        address server;
        string taskId;
        uint8 rating;
        string feedbackURI;
        uint256 timestamp;
    }
    
    /**
     * @dev Validation request information
     * @param requester Address requesting validation
     * @param taskId Identifier for the task to validate
     * @param dataHash Hash of the data/result to validate
     * @param validationType Type of validation requested
     * @param requestTime When validation was requested
     * @param isCompleted Whether validation is completed
     */
    struct ValidationRequest {
        address requester;
        string taskId;
        bytes32 dataHash;
        string validationType;
        uint256 requestTime;
        bool isCompleted;
    }
    
    /**
     * @dev Validation response information
     * @param validator Address of the validator
     * @param requestId ID of the validation request
     * @param score Validation score (0-100)
     * @param verified Whether the validation passed
     * @param proofURI URI pointing to validation proof
     * @param responseTime When validation response was submitted
     */
    struct ValidationResponse {
        address validator;
        uint256 requestId;
        uint8 score;
        bool verified;
        string proofURI;
        uint256 responseTime;
    }
    
    // ============ Mappings ============
    
    /// @dev Mapping from agent ID to agent information
    mapping(uint256 => AgentInfo) public agents;
    
    /// @dev Mapping from address to agent ID (for reverse lookup)
    mapping(address => uint256) public addressToAgentId;
    
    /// @dev Mapping from feedback ID to feedback information
    mapping(uint256 => FeedbackInfo) public feedbacks;
    
    /// @dev Mapping from validation request ID to request information
    mapping(uint256 => ValidationRequest) public validationRequests;
    
    /// @dev Mapping from validation request ID to response information
    mapping(uint256 => ValidationResponse) public validationResponses;
    
    /// @dev Mapping to track feedback IDs for each server agent
    mapping(address => uint256[]) public agentFeedbacks;
    
    /// @dev Mapping to track validation request IDs for each agent
    mapping(address => uint256[]) public agentValidations;
    
    // ============ Events ============
    
    /**
     * @dev Emitted when a new agent is registered
     * @param owner Address of the agent owner
     * @param agentId Unique identifier for the agent
     * @param metadataURI URI pointing to agent's registration file
     */
    event AgentRegistered(
        address indexed owner,
        uint256 indexed agentId,
        string metadataURI
    );
    
    /**
     * @dev Emitted when agent metadata is updated
     * @param agentId Unique identifier for the agent
     * @param newMetadataURI New URI pointing to updated registration file
     */
    event AgentMetadataUpdated(
        uint256 indexed agentId,
        string newMetadataURI
    );
    
    /**
     * @dev Emitted when an agent is deactivated
     * @param agentId Unique identifier for the agent
     * @param owner Address of the agent owner
     */
    event AgentDeactivated(
        uint256 indexed agentId,
        address indexed owner
    );
    
    /**
     * @dev Emitted when feedback is submitted
     * @param feedbackId Unique identifier for the feedback
     * @param client Address of the client providing feedback
     * @param server Address of the server receiving feedback
     * @param taskId Identifier for the task
     * @param rating Overall rating given
     */
    event FeedbackSubmitted(
        uint256 indexed feedbackId,
        address indexed client,
        address indexed server,
        string taskId,
        uint8 rating
    );
    
    /**
     * @dev Emitted when validation is requested
     * @param requestId Unique identifier for the validation request
     * @param requester Address requesting validation
     * @param taskId Identifier for the task
     * @param dataHash Hash of the data to validate
     */
    event ValidationRequested(
        uint256 indexed requestId,
        address indexed requester,
        string taskId,
        bytes32 dataHash
    );
    
    /**
     * @dev Emitted when validation response is submitted
     * @param requestId Unique identifier for the validation request
     * @param validator Address of the validator
     * @param score Validation score
     * @param verified Whether validation passed
     */
    event ValidationResponseSubmitted(
        uint256 indexed requestId,
        address indexed validator,
        uint8 score,
        bool verified
    );
    
    // ============ Constructor ============
    
    /**
     * @dev Initializes the ERC-8004 Trustless Agents contract
     */
    constructor() ERC721("ERC8004TrustlessAgents", "ERC8004") Ownable(msg.sender) {
        _currentAgentId = 0;
        _currentFeedbackId = 0;
        _currentValidationId = 0;
    }
    
    // ============ Identity Registry Functions ============
    
    /**
     * @dev Registers a new agent with the Identity Registry
     * @param metadataURI URI pointing to agent's registration file (must follow ERC-8004 format)
     * @return agentId The unique identifier assigned to the agent
     * 
     * Requirements:
     * - metadataURI must not be empty
     * - Caller must not already have a registered agent
     * - metadataURI should point to valid JSON following ERC-8004 schema
     */
    function registerAgent(string memory metadataURI) 
        external 
        nonReentrant 
        returns (uint256) 
    {
        require(bytes(metadataURI).length > 0, "ERC8004: metadata URI cannot be empty");
        require(addressToAgentId[msg.sender] == 0, "ERC8004: agent already registered for this address");
        
        _currentAgentId++;
        uint256 newAgentId = _currentAgentId;
        
        // Mint NFT to represent agent identity
        _mint(msg.sender, newAgentId);
        _setTokenURI(newAgentId, metadataURI);
        
        // Store agent information
        agents[newAgentId] = AgentInfo({
            owner: msg.sender,
            metadataURI: metadataURI,
            registrationTime: block.timestamp,
            isActive: true
        });
        
        // Create reverse mapping
        addressToAgentId[msg.sender] = newAgentId;
        
        emit AgentRegistered(msg.sender, newAgentId, metadataURI);
        return newAgentId;
    }
    
    /**
     * @dev Updates the metadata URI for an existing agent
     * @param agentId The agent ID to update
     * @param newMetadataURI New URI pointing to updated registration file
     * 
     * Requirements:
     * - Caller must be the owner of the agent or approved
     * - Agent must exist and be active
     * - newMetadataURI must not be empty
     */
    function updateAgentMetadata(uint256 agentId, string memory newMetadataURI) 
        external 
        nonReentrant 
    {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "ERC8004: caller is not owner nor approved");
        require(agents[agentId].isActive, "ERC8004: agent is not active");
        require(bytes(newMetadataURI).length > 0, "ERC8004: metadata URI cannot be empty");
        
        _setTokenURI(agentId, newMetadataURI);
        agents[agentId].metadataURI = newMetadataURI;
        
        emit AgentMetadataUpdated(agentId, newMetadataURI);
    }
    
    /**
     * @dev Deactivates an agent (soft delete)
     * @param agentId The agent ID to deactivate
     * 
     * Requirements:
     * - Caller must be the owner of the agent
     * - Agent must exist and be active
     */
    function deactivateAgent(uint256 agentId) external nonReentrant {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "ERC8004: caller is not owner nor approved");
        require(agents[agentId].isActive, "ERC8004: agent is already inactive");
        
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId, msg.sender);
    }
    
    /**
     * @dev Gets agent information by agent ID
     * @param agentId The agent ID to query
     * @return Agent information struct
     */
    function getAgent(uint256 agentId) external view returns (AgentInfo memory) {
        require(_ownerOf(agentId) != address(0), "ERC8004: agent does not exist");
        return agents[agentId];
    }
    
    /**
     * @dev Gets agent ID by address
     * @param agentAddress The address to query
     * @return The agent ID associated with the address (0 if not registered)
     */
    function getAgentIdByAddress(address agentAddress) external view returns (uint256) {
        return addressToAgentId[agentAddress];
    }
    
    // ============ Reputation Registry Functions ============
    
    /**
     * @dev Submits feedback for a server agent
     * @param server Address of the server agent receiving feedback
     * @param taskId Identifier for the completed task
     * @param rating Overall rating (0-100)
     * @param feedbackURI URI pointing to detailed feedback data
     * @return feedbackId The unique identifier for this feedback
     * 
     * Requirements:
     * - Caller must be a registered agent
     * - Server must be a registered and active agent
     * - Rating must be between 0 and 100
     * - feedbackURI must not be empty
     */
    function submitFeedback(
        address server,
        string memory taskId,
        uint8 rating,
        string memory feedbackURI
    ) external nonReentrant returns (uint256) {
        require(addressToAgentId[msg.sender] != 0, "ERC8004: caller is not a registered agent");
        require(addressToAgentId[server] != 0, "ERC8004: server is not a registered agent");
        require(agents[addressToAgentId[server]].isActive, "ERC8004: server agent is not active");
        require(rating <= 100, "ERC8004: rating must be between 0 and 100");
        require(bytes(feedbackURI).length > 0, "ERC8004: feedback URI cannot be empty");
        require(bytes(taskId).length > 0, "ERC8004: task ID cannot be empty");
        
        _currentFeedbackId++;
        uint256 newFeedbackId = _currentFeedbackId;
        
        feedbacks[newFeedbackId] = FeedbackInfo({
            client: msg.sender,
            server: server,
            taskId: taskId,
            rating: rating,
            feedbackURI: feedbackURI,
            timestamp: block.timestamp
        });
        
        agentFeedbacks[server].push(newFeedbackId);
        
        emit FeedbackSubmitted(newFeedbackId, msg.sender, server, taskId, rating);
        return newFeedbackId;
    }
    
    /**
     * @dev Gets feedback information by feedback ID
     * @param feedbackId The feedback ID to query
     * @return Feedback information struct
     */
    function getFeedback(uint256 feedbackId) external view returns (FeedbackInfo memory) {
        require(feedbackId > 0 && feedbackId <= _currentFeedbackId, "ERC8004: feedback does not exist");
        return feedbacks[feedbackId];
    }
    
    /**
     * @dev Gets all feedback IDs for a server agent
     * @param server Address of the server agent
     * @return Array of feedback IDs
     */
    function getAgentFeedbacks(address server) external view returns (uint256[] memory) {
        return agentFeedbacks[server];
    }
    
    /**
     * @dev Calculates average rating for an agent
     * @param server Address of the server agent
     * @return Average rating (0-100), 0 if no feedback
     */
    function getAgentAverageRating(address server) external view returns (uint256) {
        uint256[] memory feedbackIds = agentFeedbacks[server];
        if (feedbackIds.length == 0) {
            return 0;
        }
        
        uint256 totalRating = 0;
        for (uint256 i = 0; i < feedbackIds.length; i++) {
            totalRating += feedbacks[feedbackIds[i]].rating;
        }
        
        return totalRating / feedbackIds.length;
    }
    
    // ============ Validation Registry Functions ============
    
    /**
     * @dev Requests validation for a task
     * @param taskId Identifier for the task to validate
     * @param dataHash Hash of the data/result to validate
     * @param validationType Type of validation requested (e.g., "zkTLS", "stake-secured")
     * @return requestId The unique identifier for this validation request
     * 
     * Requirements:
     * - Caller must be a registered agent
     * - taskId and validationType must not be empty
     * - dataHash must not be zero
     */
    function requestValidation(
        string memory taskId,
        bytes32 dataHash,
        string memory validationType
    ) external nonReentrant returns (uint256) {
        require(addressToAgentId[msg.sender] != 0, "ERC8004: caller is not a registered agent");
        require(bytes(taskId).length > 0, "ERC8004: task ID cannot be empty");
        require(dataHash != bytes32(0), "ERC8004: data hash cannot be zero");
        require(bytes(validationType).length > 0, "ERC8004: validation type cannot be empty");
        
        _currentValidationId++;
        uint256 newRequestId = _currentValidationId;
        
        validationRequests[newRequestId] = ValidationRequest({
            requester: msg.sender,
            taskId: taskId,
            dataHash: dataHash,
            validationType: validationType,
            requestTime: block.timestamp,
            isCompleted: false
        });
        
        agentValidations[msg.sender].push(newRequestId);
        
        emit ValidationRequested(newRequestId, msg.sender, taskId, dataHash);
        return newRequestId;
    }
    
    /**
     * @dev Submits validation response
     * @param requestId The validation request ID
     * @param score Validation score (0-100)
     * @param verified Whether the validation passed
     * @param proofURI URI pointing to validation proof
     * 
     * Requirements:
     * - Caller must be a registered agent
     * - Validation request must exist and not be completed
     * - Score must be between 0 and 100
     * - proofURI must not be empty
     */
    function submitValidationResponse(
        uint256 requestId,
        uint8 score,
        bool verified,
        string memory proofURI
    ) external nonReentrant {
        require(addressToAgentId[msg.sender] != 0, "ERC8004: caller is not a registered agent");
        require(requestId > 0 && requestId <= _currentValidationId, "ERC8004: validation request does not exist");
        require(!validationRequests[requestId].isCompleted, "ERC8004: validation already completed");
        require(score <= 100, "ERC8004: score must be between 0 and 100");
        require(bytes(proofURI).length > 0, "ERC8004: proof URI cannot be empty");
        
        validationRequests[requestId].isCompleted = true;
        
        validationResponses[requestId] = ValidationResponse({
            validator: msg.sender,
            requestId: requestId,
            score: score,
            verified: verified,
            proofURI: proofURI,
            responseTime: block.timestamp
        });
        
        emit ValidationResponseSubmitted(requestId, msg.sender, score, verified);
    }
    
    /**
     * @dev Gets validation request information
     * @param requestId The validation request ID
     * @return Validation request struct
     */
    function getValidationRequest(uint256 requestId) external view returns (ValidationRequest memory) {
        require(requestId > 0 && requestId <= _currentValidationId, "ERC8004: validation request does not exist");
        return validationRequests[requestId];
    }
    
    /**
     * @dev Gets validation response information
     * @param requestId The validation request ID
     * @return Validation response struct
     */
    function getValidationResponse(uint256 requestId) external view returns (ValidationResponse memory) {
        require(requestId > 0 && requestId <= _currentValidationId, "ERC8004: validation request does not exist");
        require(validationRequests[requestId].isCompleted, "ERC8004: validation not completed");
        return validationResponses[requestId];
    }
    
    /**
     * @dev Gets all validation request IDs for an agent
     * @param agent Address of the agent
     * @return Array of validation request IDs
     */
    function getAgentValidations(address agent) external view returns (uint256[] memory) {
        return agentValidations[agent];
    }
    
    // ============ Utility Functions ============
    
    /**
     * @dev Gets the current agent ID counter
     * @return The current agent ID
     */
    function getCurrentAgentId() external view returns (uint256) {
        return _currentAgentId;
    }
    
    /**
     * @dev Gets the current feedback ID counter
     * @return The current feedback ID
     */
    function getCurrentFeedbackId() external view returns (uint256) {
        return _currentFeedbackId;
    }
    
    /**
     * @dev Gets the current validation ID counter
     * @return The current validation ID
     */
    function getCurrentValidationId() external view returns (uint256) {
        return _currentValidationId;
    }
    
    /**
     * @dev Checks if an agent exists and is active
     * @param agentAddress The agent address to check
     * @return Whether the agent exists and is active
     */
    function isActiveAgent(address agentAddress) external view returns (bool) {
        uint256 agentId = addressToAgentId[agentAddress];
        return agentId != 0 && agents[agentId].isActive;
    }
    
    // ============ Override Functions ============
    
    /**
     * @dev Override to prevent token transfers (non-transferable tokens)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0)) but prevent transfers
        if (from != address(0) && to != address(0)) {
            revert("ERC8004: agent identity tokens are non-transferable");
        }
        
        return super._update(to, tokenId, auth);
    }
    
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
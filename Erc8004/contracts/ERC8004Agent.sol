// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ERC8004TrustlessAgents
 * @dev ERC-8004 Trustless Agents implementation with Identity, Reputation, and Validation registries
 */
contract ERC8004TrustlessAgents is ERC721URIStorage, Ownable, ReentrancyGuard {
    
    // ============ Custom Errors ============
    
    error EmptyMetadataURI();
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error AgentNotActive();
    error AgentNotExists();
    error NotOwnerOrApproved();
    error AgentAlreadyInactive();
    error InvalidRating();
    error EmptyFeedbackURI();
    error EmptyTaskId();
    error FeedbackNotExists();
    error InvalidDataHash();
    error EmptyValidationType();
    error ValidationNotExists();
    error ValidationAlreadyCompleted();
    error InvalidScore();
    error EmptyProofURI();
    error NonTransferableToken();
    
    // ============ State Variables ============
    
    uint256 private _currentAgentId;
    uint256 private _currentFeedbackId;
    uint256 private _currentValidationId;
    
    // ============ Structs ============
    
    struct AgentInfo {
        address owner;
        string metadataURI;
        uint256 registrationTime;
        bool isActive;
    }
    
    struct FeedbackInfo {
        address client;
        address server;
        string taskId;
        uint8 rating;
        string feedbackURI;
        uint256 timestamp;
    }
    
    struct ValidationRequest {
        address requester;
        string taskId;
        bytes32 dataHash;
        string validationType;
        uint256 requestTime;
        bool isCompleted;
    }
    
    struct ValidationResponse {
        address validator;
        uint256 requestId;
        uint8 score;
        bool verified;
        string proofURI;
        uint256 responseTime;
    }
    
    // ============ Mappings ============
    
    mapping(uint256 => AgentInfo) public agents;
    mapping(address => uint256) public addressToAgentId;
    mapping(uint256 => FeedbackInfo) public feedbacks;
    mapping(uint256 => ValidationRequest) public validationRequests;
    mapping(uint256 => ValidationResponse) public validationResponses;
    mapping(address => uint256[]) public agentFeedbacks;
    mapping(address => uint256[]) public agentValidations;
    
    // ============ Events ============
    
    event AgentRegistered(address indexed owner, uint256 indexed agentId, string metadataURI);
    event AgentMetadataUpdated(uint256 indexed agentId, string newMetadataURI);
    event AgentDeactivated(uint256 indexed agentId, address indexed owner);
    event FeedbackSubmitted(uint256 indexed feedbackId, address indexed client, address indexed server, string taskId, uint8 rating);
    event ValidationRequested(uint256 indexed requestId, address indexed requester, string taskId, bytes32 dataHash);
    event ValidationResponseSubmitted(uint256 indexed requestId, address indexed validator, uint8 score, bool verified);
    
    // ============ Constructor ============
    
    constructor() ERC721("ERC8004TrustlessAgents", "ERC8004") Ownable(msg.sender) {
        _currentAgentId = 0;
        _currentFeedbackId = 0;
        _currentValidationId = 0;
    }
    
    // ============ Identity Registry Functions ============
    
    function registerAgent(string memory metadataURI) external nonReentrant returns (uint256) {
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        if (addressToAgentId[msg.sender] != 0) revert AgentAlreadyRegistered();
        
        _currentAgentId++;
        uint256 newAgentId = _currentAgentId;
        
        _mint(msg.sender, newAgentId);
        _setTokenURI(newAgentId, metadataURI);
        
        agents[newAgentId] = AgentInfo({
            owner: msg.sender,
            metadataURI: metadataURI,
            registrationTime: block.timestamp,
            isActive: true
        });
        
        addressToAgentId[msg.sender] = newAgentId;
        
        emit AgentRegistered(msg.sender, newAgentId, metadataURI);
        return newAgentId;
    }
    
    function updateAgentMetadata(uint256 agentId, string memory newMetadataURI) external nonReentrant {
        if (!_isAuthorized(ownerOf(agentId), msg.sender, agentId)) revert NotOwnerOrApproved();
        if (!agents[agentId].isActive) revert AgentNotActive();
        if (bytes(newMetadataURI).length == 0) revert EmptyMetadataURI();
        
        _setTokenURI(agentId, newMetadataURI);
        agents[agentId].metadataURI = newMetadataURI;
        
        emit AgentMetadataUpdated(agentId, newMetadataURI);
    }
    
    function deactivateAgent(uint256 agentId) external nonReentrant {
        if (!_isAuthorized(ownerOf(agentId), msg.sender, agentId)) revert NotOwnerOrApproved();
        if (!agents[agentId].isActive) revert AgentAlreadyInactive();
        
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId, msg.sender);
    }
    
    function getAgent(uint256 agentId) external view returns (AgentInfo memory) {
        if (_ownerOf(agentId) == address(0)) revert AgentNotExists();
        return agents[agentId];
    }
    
    function getAgentIdByAddress(address agentAddress) external view returns (uint256) {
        return addressToAgentId[agentAddress];
    }
    
    // ============ Reputation Registry Functions ============
    
    function submitFeedback(
        address server,
        string memory taskId,
        uint8 rating,
        string memory feedbackURI
    ) external nonReentrant returns (uint256) {
        if (addressToAgentId[msg.sender] == 0) revert AgentNotRegistered();
        if (addressToAgentId[server] == 0) revert AgentNotRegistered();
        if (!agents[addressToAgentId[server]].isActive) revert AgentNotActive();
        if (rating > 100) revert InvalidRating();
        if (bytes(feedbackURI).length == 0) revert EmptyFeedbackURI();
        if (bytes(taskId).length == 0) revert EmptyTaskId();
        
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
    
    function getFeedback(uint256 feedbackId) external view returns (FeedbackInfo memory) {
        if (feedbackId == 0 || feedbackId > _currentFeedbackId) revert FeedbackNotExists();
        return feedbacks[feedbackId];
    }
    
    function getAgentFeedbacks(address server) external view returns (uint256[] memory) {
        return agentFeedbacks[server];
    }
    
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
    
    function requestValidation(
        string memory taskId,
        bytes32 dataHash,
        string memory validationType
    ) external nonReentrant returns (uint256) {
        if (addressToAgentId[msg.sender] == 0) revert AgentNotRegistered();
        if (bytes(taskId).length == 0) revert EmptyTaskId();
        if (dataHash == bytes32(0)) revert InvalidDataHash();
        if (bytes(validationType).length == 0) revert EmptyValidationType();
        
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
    
    function submitValidationResponse(
        uint256 requestId,
        uint8 score,
        bool verified,
        string memory proofURI
    ) external nonReentrant {
        if (addressToAgentId[msg.sender] == 0) revert AgentNotRegistered();
        if (requestId == 0 || requestId > _currentValidationId) revert ValidationNotExists();
        if (validationRequests[requestId].isCompleted) revert ValidationAlreadyCompleted();
        if (score > 100) revert InvalidScore();
        if (bytes(proofURI).length == 0) revert EmptyProofURI();
        
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
    
    function getValidationRequest(uint256 requestId) external view returns (ValidationRequest memory) {
        if (requestId == 0 || requestId > _currentValidationId) revert ValidationNotExists();
        return validationRequests[requestId];
    }
    
    function getValidationResponse(uint256 requestId) external view returns (ValidationResponse memory) {
        if (requestId == 0 || requestId > _currentValidationId) revert ValidationNotExists();
        if (!validationRequests[requestId].isCompleted) revert ValidationAlreadyCompleted();
        return validationResponses[requestId];
    }
    
    function getAgentValidations(address agent) external view returns (uint256[] memory) {
        return agentValidations[agent];
    }
    
    // ============ Utility Functions ============
    
    function getCurrentAgentId() external view returns (uint256) {
        return _currentAgentId;
    }
    
    function getCurrentFeedbackId() external view returns (uint256) {
        return _currentFeedbackId;
    }
    
    function getCurrentValidationId() external view returns (uint256) {
        return _currentValidationId;
    }
    
    function isActiveAgent(address agentAddress) external view returns (bool) {
        uint256 agentId = addressToAgentId[agentAddress];
        return agentId != 0 && agents[agentId].isActive;
    }
    
    // ============ Override Functions ============
    
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        if (from != address(0) && to != address(0)) {
            revert NonTransferableToken();
        }
        
        return super._update(to, tokenId, auth);
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
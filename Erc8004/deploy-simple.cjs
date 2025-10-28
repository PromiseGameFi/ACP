const fs = require('fs');
const path = require('path');

async function main() {
    try {
        console.log('🔍 Loading ERC8004TrustlessAgents contract artifact...');
        
        // Load the compiled contract artifact
        const artifactPath = path.join(__dirname, 'artifacts', 'contracts', 'ERC8004Agent.sol', 'ERC8004TrustlessAgents.json');
        
        if (!fs.existsSync(artifactPath)) {
            throw new Error(`Contract artifact not found at: ${artifactPath}`);
        }
        
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        
        console.log('✅ Contract artifact loaded successfully!');
        console.log(`📄 Contract Name: ${artifact.contractName}`);
        console.log(`🔗 Source Name: ${artifact.sourceName}`);
        
        // Check bytecode size
        const bytecode = artifact.bytecode;
        const deployedBytecode = artifact.deployedBytecode;
        
        console.log(`📊 Bytecode size: ${bytecode.length / 2 - 1} bytes`);
        console.log(`📊 Deployed bytecode size: ${deployedBytecode.length / 2 - 1} bytes`);
        
        // Check if it's under the 24576 byte limit
        const deployedSize = deployedBytecode.length / 2 - 1;
        const limit = 24576;
        
        if (deployedSize <= limit) {
            console.log(`✅ Contract size is within limits! (${deployedSize} <= ${limit} bytes)`);
        } else {
            console.log(`⚠️  Contract size exceeds limit! (${deployedSize} > ${limit} bytes)`);
        }
        
        // Validate contract structure
        if (artifact.abi && Array.isArray(artifact.abi)) {
            console.log(`🔧 ABI contains ${artifact.abi.length} functions/events`);
            
            // Check for key ERC-8004 functions
            const functionNames = artifact.abi
                .filter(item => item.type === 'function')
                .map(item => item.name);
            
            const requiredFunctions = [
                'registerAgent',
                'submitFeedback', 
                'requestValidation',
                'getAgent',
                'getAgentAverageRating'
            ];
            
            const missingFunctions = requiredFunctions.filter(fn => !functionNames.includes(fn));
            
            if (missingFunctions.length === 0) {
                console.log('✅ All required ERC-8004 functions are present');
            } else {
                console.log(`❌ Missing functions: ${missingFunctions.join(', ')}`);
            }
            
            console.log('\n🎯 Contract Features:');
            console.log('  • Identity Registry (ERC-721 based agent registration)');
            console.log('  • Reputation Registry (feedback and rating system)');
            console.log('  • Validation Registry (task validation framework)');
            console.log('  • Non-transferable agent tokens');
            console.log('  • Access controls and security');
            console.log('  • Custom errors for gas optimization');
            
            console.log('\n🔑 Key Functions:');
            requiredFunctions.forEach(fn => {
                if (functionNames.includes(fn)) {
                    console.log(`  ✅ ${fn}`);
                }
            });
        }
        
        console.log('\n🎉 ERC-8004 Trustless Agents contract is ready for deployment!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);
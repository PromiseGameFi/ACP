import pkg from 'hardhat';
const { ethers } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

async function main() {
  // 1. Get the ContractFactory for ERC8004Agent
  const ERC8004Agent = await ethers.getContractFactory("ERC8004Agent");

  // 2. Deploy the contract
  const erc8004Agent = await ERC8004Agent.deploy();

  await erc8004Agent.waitForDeployment();

  console.log("ERC8004Agent deployed to:", erc8004Agent.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
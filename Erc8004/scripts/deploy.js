import hre from "hardhat";

async function main() {
  const ERC8004Agent = await hre.ethers.getContractFactory("ERC8004Agent");
  const erc8004Agent = await ERC8004Agent.deploy();

  await erc8004Agent.waitForDeployment();

  console.log("ERC8004Agent deployed to:", erc8004Agent.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
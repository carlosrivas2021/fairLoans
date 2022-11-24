import { ethers } from "hardhat";

async function main() {
  const MyFairLoans = await ethers.getContractFactory("MyFairLoans");
  const token = await MyFairLoans.deploy();

  await token.deployed();

  console.log("MyFairLoans deployed to:", token.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
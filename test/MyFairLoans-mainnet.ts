import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20";

describe("MyFairLoans Mainnet fork", function () {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, borrower] = await ethers.getSigners();

    const MyFairLoans = await ethers.getContractFactory("MyFairLoans");
    const myFairLoans = await MyFairLoans.deploy();

    const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const daiToken = (await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      DAI
    )) as IERC20;
    const lender = "0x8CA3c80fc701224d328017Fb0b3090a8Fa6F8F73";
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [lender],
    });
    const lenderSigner = ethers.provider.getSigner(lender);

    return { myFairLoans, owner, borrower, daiToken, lenderSigner };
  }

  describe("Loans", function () {
    it("Should set the other contracts", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);

      expect(await myFairLoans.totalCollateral()).to.be.equal(0);
    });
  });

  describe("Asset", function () {
    it("bondAsset", async function () {
      const { myFairLoans, lenderSigner, daiToken } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      expect(
        await myFairLoans.balanceOf(lenderSigner.getAddress())
      ).to.be.equal(amountBonded);
    });

    it("unbondAsset", async function () {
      const { myFairLoans, owner, daiToken, lenderSigner } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      expect(
        await myFairLoans.balanceOf(lenderSigner.getAddress())
      ).to.be.equal(amountBonded);

      await myFairLoans.connect(lenderSigner).unbondAsset(amountBonded);

      expect(await myFairLoans.balanceOf(owner.address)).to.be.equal(0);
    });

    it("unbondAsset with error", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const amountBonded = ethers.utils.parseEther("100");
      await expect(
        myFairLoans.unbondAsset(amountBonded)
      ).to.be.revertedWith("Not enough bonds!");
    });
  });

  describe("Borrows", function () {
    it("addCollateral", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });

      expect(await myFairLoans.totalCollateral()).to.be.equal(pay);
    });

    it("addCollateral with error", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const pay = ethers.utils.parseEther("0");

      await expect(
        myFairLoans.addCollateral({ value: pay })
      ).to.be.revertedWith("Cant send 0 ethers");
    });

    it("removeCollateral", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const collateralAmount = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: collateralAmount });
      await myFairLoans.removeCollateral(collateralAmount);

      expect(await myFairLoans.totalCollateral()).to.be.equal(0);
    });

    it("borrow", async function () {
      const { myFairLoans, daiToken, lenderSigner } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      const collateralAmount = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: collateralAmount });
      const borrowedAmount = ethers.utils.parseEther("10");
      await myFairLoans.borrow(borrowedAmount);

      expect(await myFairLoans.getBorrowed()).to.be.equal(borrowedAmount);
    });

    it("borrow with error", async function () {
      const { myFairLoans, daiToken, lenderSigner } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      const collateralAmount = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: collateralAmount });
      const borrowedAmount = ethers.utils.parseEther("10000");

      await expect(myFairLoans.borrow(borrowedAmount)).to.be.revertedWith(
        "No collateral enough"
      );
    });

    it("repay", async function () {
      const { myFairLoans, daiToken, lenderSigner } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      const collateralAmount = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: collateralAmount });
      const borrowedAmount = ethers.utils.parseEther("10");
      await myFairLoans.borrow(borrowedAmount);

      await daiToken.approve(myFairLoans.address, borrowedAmount);
      await myFairLoans.repay(borrowedAmount);

      expect(await myFairLoans.getBorrowed()).to.be.equal(
        ethers.utils.parseEther("3")
      );
    });

    it("repay with error", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);

      await expect(myFairLoans.repay(100)).to.be.revertedWith(
        "Doesn't have a debt to pay"
      );
    });

    it("Liquidation", async function () {
      const { myFairLoans, daiToken, lenderSigner, owner } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      const firstDaiBalance = await daiToken.balanceOf(myFairLoans.address);
      const collateralAmount = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: collateralAmount });
      const borrowedAmount = ethers.utils.parseEther("10");
      await myFairLoans.borrow(borrowedAmount);
      await myFairLoans.liquidation(owner.address, true);

      const lastDaiBalance = await daiToken.balanceOf(myFairLoans.address);

      expect(await myFairLoans.getBorrowed()).to.be.equal(0);
      expect(firstDaiBalance).to.be.not.equal(lastDaiBalance);
    });

    it("Liquidation with error", async function () {
      const { myFairLoans, daiToken, lenderSigner, owner } = await loadFixture(
        deployFixture
      );

      const approveAmount = ethers.utils.parseEther("100");
      await daiToken
        .connect(lenderSigner)
        .approve(myFairLoans.address, approveAmount);

      const amountBonded = ethers.utils.parseEther("100");
      await myFairLoans.connect(lenderSigner).bondAsset(amountBonded);

      const collateralAmount = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: collateralAmount });
      const borrowedAmount = ethers.utils.parseEther("10");
      await myFairLoans.borrow(borrowedAmount);

      await expect(
        myFairLoans.liquidation(owner.address, false)
      ).to.be.revertedWith("It's not moment to liquidation");
    });
  });
});

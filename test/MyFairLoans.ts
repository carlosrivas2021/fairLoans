import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20";
import AggregatorV3Interface from "../artifacts/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol/AggregatorV3Interface";
import ISwapRouter from "../artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter";

describe("MyFairLoans Test Mockeados", function () {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const MyFairLoans = await ethers.getContractFactory("MyFairLoans");
    const myFairLoans = await MyFairLoans.deploy();

    return { myFairLoans, owner, otherAccount };
  }

  describe("Loans", function () {
    it("Should set the other contracts", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);

      await expect(await myFairLoans.totalCollateral()).to.be.equal(0);
    });
  });

  describe("Asset", function () {
    it("bondAsset", async function () {
      const { myFairLoans, owner } = await loadFixture(deployFixture);
      const myFake = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake.transferFrom.returns(true);

      await myFairLoans.bondAsset(100000000000000n);

      expect(await myFairLoans.balanceOf(owner.address)).to.be.equal(
        100000000000000
      );
    });

    it("unbondAsset", async function () {
      const { myFairLoans, owner } = await loadFixture(deployFixture);
      const myFake = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake.transfer.returns(true);

      await myFairLoans.bondAsset(100000000000000n);

      expect(await myFairLoans.balanceOf(owner.address)).to.be.equal(
        100000000000000
      );

      await myFairLoans.unbondAsset(100000000000000n);

      expect(await myFairLoans.balanceOf(owner.address)).to.be.equal(0);
    });

    it("unbondAsset with error", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });

      await expect(
        myFairLoans.unbondAsset(100000000000000n)
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
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      await myFairLoans.removeCollateral(pay);

      expect(await myFairLoans.totalCollateral()).to.be.equal(0);
    });

    it("removeCollateral without collateral", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const pay = ethers.utils.parseEther("1");

      await expect(myFairLoans.removeCollateral(pay)).to.be.revertedWith(
        "Dont have any collateral"
      );
    });

    it("removeCollateral not enough collateral", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      const remove = ethers.utils.parseEther("2");

      await expect(myFairLoans.removeCollateral(remove)).to.be.revertedWith(
        "Not enough collateral to remove"
      );
    });

    it("borrow", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const myFake2 = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake2.transfer.returns(true);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      await myFairLoans.borrow(100);

      expect(await myFairLoans.getBorrowed()).to.be.equal(100);
    });

    it("borrow with error", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const myFake2 = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake2.transfer.returns(true);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      const borrow = ethers.utils.parseEther("2");

      await expect(myFairLoans.borrow(borrow)).to.be.revertedWith(
        "No collateral enough"
      );
    });

    it("repay", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const myFake2 = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake2.transfer.returns(true);
      myFake2.transferFrom.returns(true);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      await myFairLoans.borrow(100);
      await myFairLoans.repay(100);

      expect(await myFairLoans.getBorrowed()).to.be.equal(2);
    });

    it("repay with error", async function () {
      const { myFairLoans } = await loadFixture(deployFixture);

      await expect(myFairLoans.repay(100)).to.be.revertedWith(
        "Doesn't have a debt to pay"
      );
    });

    it("Liquidation", async function () {
      const { myFairLoans, owner } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const myFake2 = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake2.transfer.returns(true);

      const myFake3 = await smock.fake<ISwapRouter>(ISwapRouter.abi, {
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      });
      myFake3.exactInputSingle.returns(100);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      await myFairLoans.borrow(100);
      myFake.latestRoundData.returns([1, 0, 3, 4, 5]);
      await myFairLoans.liquidation(owner.address, false)

      expect(await myFairLoans.getBorrowed()).to.be.equal(0);
    });

    it("Liquidation with error", async function () {
      const { myFairLoans, owner } = await loadFixture(deployFixture);
      const myFake = await smock.fake<AggregatorV3Interface>(
        AggregatorV3Interface.abi,
        { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" }
      );
      myFake.latestRoundData.returns([1, 100000000, 3, 4, 5]);
      const myFake2 = await smock.fake<IERC20>(IERC20.abi, {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      });
      myFake2.transfer.returns(true);
      const pay = ethers.utils.parseEther("1");
      await myFairLoans.addCollateral({ value: pay });
      await myFairLoans.borrow(100);

      await expect(myFairLoans.liquidation(owner.address, false)).to.be.revertedWith(
        "It's not moment to liquidation"
      );
    });

  });
});

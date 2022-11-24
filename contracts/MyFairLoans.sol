//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "./interfaces/ISwapRouter.sol";
import "./Math.sol";
import "./CalculateFee.sol";

contract MyFairLoans is ERC20Burnable, Ownable, Math, CalculateFee {
    using SafeMath for uint256;

    uint256 public totalMarkets;
    uint256 public totalBorrowed;
    uint256 public totalReserve;
    uint256 public totalDeposit;
    uint256 public maxLTV = 80;
    uint256 public totalCollateral;
    uint256 public baseRate = 20000000000000000;
    uint256 public fixedAnnuBorrowRate = 300000000000000000;

    IERC20 public constant dai =
        IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 private constant weth =
        IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    AggregatorV3Interface internal constant priceFeed =
        AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    ISwapRouter public constant uniswapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    mapping(address => uint256) private usersCollateral;
    mapping(address => uint256) private usersBorrowed;

    // Events
    event BondAsset(address sender, uint256 deposit, uint256 minted);
    event UnbondAsset(address sender, uint256 deposit, uint256 dai);
    event AddCollateral(
        address sender,
        uint256 collateral,
        uint256 totalCollateral
    );
    event RemoveCollateral(
        address sender,
        uint256 collateral,
        uint256 totalCollateral
    );
    event Borrow(address sender, uint256 borrow, uint256 totalBorrow);
    event Repay(address sender, uint256 pay, uint256 totalBorrow);
    event Liquidation(address user, uint256 pay, uint256 totalCollateral);

    constructor() ERC20("DLYToken", "DLYC") {}

    function bondAsset(uint256 _amount) external {
        dai.transferFrom(msg.sender, address(this), _amount);
        totalDeposit += _amount;
        uint256 bondsToMint = getExp(_amount, getExchangeRate());
        _mint(msg.sender, bondsToMint);
        emit BondAsset(msg.sender, _amount, bondsToMint);
    }

    function unbondAsset(uint256 _amount) external {
        require(_amount <= balanceOf(msg.sender), "Not enough bonds!");
        uint256 daiToReceive = mulExp(_amount, getExchangeRate());
        totalDeposit -= daiToReceive;
        burn(_amount);
        dai.transfer(msg.sender, daiToReceive);
        emit UnbondAsset(msg.sender, _amount, daiToReceive);
    }

    function addCollateral() external payable {
        require(msg.value != 0, "Cant send 0 ethers");
        usersCollateral[msg.sender] += msg.value;
        totalCollateral += msg.value;
        emit AddCollateral(msg.sender, msg.value, totalCollateral);
    }

    function removeCollateral(uint256 _amount) external {
        uint256 ethPrice = uint256(_getLatestPrice(false));
        uint256 collateral = usersCollateral[msg.sender];
        require(collateral > 0, "Dont have any collateral");
        uint256 borrowed = usersBorrowed[msg.sender];
        uint256 amountLeft = mulExp(collateral, ethPrice) - borrowed;
        uint256 amountToRemove = mulExp(_amount, ethPrice);
        require(
            amountToRemove <= amountLeft,
            "Not enough collateral to remove"
        );
        usersCollateral[msg.sender] -= _amount;
        totalCollateral -= _amount;
        payable(address(this)).transfer(_amount);
        emit RemoveCollateral(msg.sender, _amount, totalCollateral);
    }

    function borrow(uint256 _amount) external {
        require(_amount <= _borrowLimit(), "No collateral enough");
        usersBorrowed[msg.sender] += _amount;
        totalBorrowed += _amount;
        dai.transfer(msg.sender, _amount);
        emit Borrow(msg.sender, _amount, totalBorrowed);
    }

    function repay(uint256 _amount) external {
        uint256 debt = usersBorrowed[msg.sender];
        require(debt > 0, "Doesn't have a debt to pay");
        dai.transferFrom(msg.sender, address(this), _amount);
        (uint256 fee, uint256 paid) = calculateBorrowFee(_amount);
        usersBorrowed[msg.sender] -= paid;
        if (usersBorrowed[msg.sender] == 0) {
            recalculateUserRate(msg.sender);
        }
        totalBorrowed -= paid;
        totalReserve += fee;
        emit Repay(msg.sender, _amount, totalBorrowed);
    }

    function calculateBorrowFee(uint256 _amount)
        public
        returns (uint256, uint256)
    {
        uint256 borrowRate = _borrowRate();
        uint256 fee = mulExp(_amount, borrowRate);
        uint256 userFee = getFee(msg.sender);
        fee = percentage(fee, userFee);
        uint256 paid = _amount - fee;
        return (fee, paid);
    }

    function liquidation(address _user, bool fake) external {
        uint256 ethPrice = uint256(_getLatestPrice(fake));
        uint256 collateral = usersCollateral[_user];
        uint256 borrowed = usersBorrowed[_user];
        uint256 collateralToUsd = mulExp(ethPrice, collateral);
        require(
            borrowed > percentage(collateralToUsd, maxLTV),
            "It's not moment to liquidation"
        );
        uint256 amountDai = _convertEthToDai(collateral);
        if (amountDai > borrowed) {
            uint256 extraAmount = amountDai - borrowed;
            totalReserve += extraAmount;
        }
        usersBorrowed[_user] = 0;
        usersCollateral[_user] = 0;
        totalCollateral -= collateral;
        emit Liquidation(_user, amountDai, totalCollateral);
    }

    function _borrowLimit() public view returns (uint256) {
        uint256 amountLocked = usersCollateral[msg.sender];
        require(amountLocked > 0, "No collateral found");
        uint256 amountBorrowed = usersBorrowed[msg.sender];
        uint256 ethPrice = uint256(_getLatestPrice(false));
        uint256 amountLeft = mulExp(amountLocked, ethPrice) - amountBorrowed;
        return percentage(amountLeft, maxLTV);
    }

    function getCollateral() external view returns (uint256) {
        return usersCollateral[msg.sender];
    }

    function getBorrowed() external view returns (uint256) {
        return usersBorrowed[msg.sender];
    }

    function _getLatestPrice(bool fake) public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        // This condition is only to local test
        if (fake) {
            price = 10;
        }
        return price * 10**10;
    }

    function getExchangeRate() public view returns (uint256) {
        if (totalSupply() == 0) {
            return 1e18;
        }
        uint256 cash = getCash();
        uint256 num = cash + totalBorrowed + totalReserve;
        return getExp(num, totalSupply());
    }

    function getCash() public view returns (uint256) {
        return totalDeposit - totalBorrowed;
    }

    function _utilizationRatio() public view returns (uint256) {
        return getExp(totalBorrowed, totalDeposit);
    }

    function _interestMultiplier() public view returns (uint256) {
        uint256 uRatio = _utilizationRatio();
        uint256 num = fixedAnnuBorrowRate - baseRate;
        return getExp(num, uRatio);
    }

    function _borrowRate() public view returns (uint256) {
        uint256 uRatio = _utilizationRatio();
        uint256 interestMul = _interestMultiplier();
        uint256 product = mulExp(uRatio, interestMul);
        return product + baseRate;
    }

    function _convertEthToDai(uint256 _amount) internal returns (uint256) {
        require(_amount > 0, "Must pass non 0 amount");

        uint256 deadline = block.timestamp + 15; // using 'now' for convenience
        address tokenIn = address(weth);
        address tokenOut = address(dai);
        uint24 fee = 3000;
        address recipient = address(this);
        uint256 amountIn = _amount;
        uint256 amountOutMinimum = 1;
        uint160 sqrtPriceLimitX96 = 0;

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams(
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                amountIn,
                amountOutMinimum,
                sqrtPriceLimitX96
            );

        uint256 amountOut = uniswapRouter.exactInputSingle{value: _amount}(
            params
        );
        return amountOut;
    }

    receive() external payable {}

    fallback() external payable {}
}

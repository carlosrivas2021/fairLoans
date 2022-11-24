// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CalculateFee is Ownable {
    mapping(address => uint256) private usersFee;
    mapping(address => uint256) private usersBorrow;

    constructor() {}

    function setBorrow(address _user) public onlyOwner {
        usersBorrow[_user] = block.timestamp;
    }

    function recalculateUserRate(address _user) public onlyOwner {
        if (usersBorrow[_user] + 5 days <= block.timestamp) {
            usersFee[_user] = 95;
        } else if (usersBorrow[_user] + 10 days <= block.timestamp) {
            usersFee[_user] = 98;
        } else {
            usersFee[_user] = 100;
        }
    }

    function getFee(address _user) public returns (uint256) {
        if (usersFee[_user] == 0) {
            usersFee[_user] = 100;
        }
        return usersFee[_user];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchPayout} from "../src/BatchPayout.sol";
import {MockERC20} from "./MockERC20.sol";

contract BatchPayoutTest is Test {
    BatchPayout internal payout;
    MockERC20 internal token;
    address internal payer = address(0xA11CE);
    address internal a = address(0x1);
    address internal b = address(0x2);

    function setUp() public {
        payout = new BatchPayout();
        token = new MockERC20();
        token.mint(payer, 1_000_000);
        vm.prank(payer);
        token.approve(address(payout), type(uint256).max);
    }

    function _tos() internal view returns (address[] memory tos) {
        tos = new address[](2);
        tos[0] = a;
        tos[1] = b;
    }

    function _amounts() internal pure returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = 100;
        amounts[1] = 250;
    }

    function test_executeTransfersAll() public {
        vm.prank(payer);
        payout.execute(address(token), _tos(), _amounts(), bytes32(uint256(1)), block.timestamp + 1 hours);
        assertEq(token.balanceOf(a), 100);
        assertEq(token.balanceOf(b), 250);
        assertEq(token.balanceOf(payer), 1_000_000 - 350);
        assertTrue(payout.usedBatchIds(bytes32(uint256(1))));
    }

    function test_revertOnReplay() public {
        vm.prank(payer);
        payout.execute(address(token), _tos(), _amounts(), bytes32(uint256(1)), block.timestamp + 1 hours);
        vm.prank(payer);
        vm.expectRevert(BatchPayout.Replay.selector);
        payout.execute(address(token), _tos(), _amounts(), bytes32(uint256(1)), block.timestamp + 1 hours);
    }

    function test_revertOnExpiredDeadline() public {
        vm.prank(payer);
        vm.expectRevert(BatchPayout.Expired.selector);
        payout.execute(address(token), _tos(), _amounts(), bytes32(uint256(1)), block.timestamp - 1);
    }

    function test_revertWholeBatchIfAnyTransferFails() public {
        token.setFailTo(b);
        vm.prank(payer);
        vm.expectRevert(bytes("TRANSFER_FROM_FAILED"));
        payout.execute(address(token), _tos(), _amounts(), bytes32(uint256(2)), block.timestamp + 1 hours);
        assertEq(token.balanceOf(a), 0);
        assertEq(token.balanceOf(b), 0);
        assertEq(token.balanceOf(payer), 1_000_000);
        assertFalse(payout.usedBatchIds(bytes32(uint256(2))));
    }

    function test_revertOnZeroRecipient() public {
        address[] memory tos = _tos();
        tos[0] = address(0);
        vm.prank(payer);
        vm.expectRevert(BatchPayout.InvalidRecipient.selector);
        payout.execute(address(token), tos, _amounts(), bytes32(uint256(3)), block.timestamp + 1 hours);
    }

    function test_revertOnZeroAmount() public {
        uint256[] memory amounts = _amounts();
        amounts[1] = 0;
        vm.prank(payer);
        vm.expectRevert(BatchPayout.InvalidAmount.selector);
        payout.execute(address(token), _tos(), amounts, bytes32(uint256(4)), block.timestamp + 1 hours);
    }

    function test_revertOnLengthMismatch() public {
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;
        vm.prank(payer);
        vm.expectRevert(BatchPayout.LengthMismatch.selector);
        payout.execute(address(token), _tos(), amounts, bytes32(uint256(5)), block.timestamp + 1 hours);
    }

    function test_revertOnEmptyBatch() public {
        address[] memory tos = new address[](0);
        uint256[] memory amounts = new uint256[](0);
        vm.prank(payer);
        vm.expectRevert(BatchPayout.EmptyBatch.selector);
        payout.execute(address(token), tos, amounts, bytes32(uint256(6)), block.timestamp + 1 hours);
    }
}

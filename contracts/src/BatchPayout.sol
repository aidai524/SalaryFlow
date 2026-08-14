// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal ERC-20 surface used by BatchPayout.
interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @dev Handles USDT-style tokens that omit a return value.
library SafeERC20 {
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }
}

/// @title BatchPayout
/// @notice Pulls ERC-20 from `msg.sender` (via prior approve) and loops transfers
///         to 1Click deposit addresses. Any failed transfer reverts the whole batch.
contract BatchPayout {
    mapping(bytes32 => bool) public usedBatchIds;

    event BatchExecuted(bytes32 indexed batchId, address indexed token, address indexed payer, uint256 count);

    error Replay();
    error Expired();
    error LengthMismatch();
    error EmptyBatch();
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidToken();

    function execute(
        address token,
        address[] calldata tos,
        uint256[] calldata amounts,
        bytes32 batchId,
        uint256 deadline
    ) external {
        if (token == address(0)) revert InvalidToken();
        if (block.timestamp > deadline) revert Expired();
        if (usedBatchIds[batchId]) revert Replay();

        uint256 n = tos.length;
        if (n == 0) revert EmptyBatch();
        if (n != amounts.length) revert LengthMismatch();

        usedBatchIds[batchId] = true;

        IERC20 erc20 = IERC20(token);
        for (uint256 i = 0; i < n;) {
            address to = tos[i];
            uint256 amount = amounts[i];
            if (to == address(0)) revert InvalidRecipient();
            if (amount == 0) revert InvalidAmount();
            SafeERC20.safeTransferFrom(erc20, msg.sender, to, amount);
            unchecked {
                ++i;
            }
        }

        emit BatchExecuted(batchId, token, msg.sender, n);
    }
}

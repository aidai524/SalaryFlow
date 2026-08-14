// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BatchPayout} from "../src/BatchPayout.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        console2.log("Deployer", deployer);
        vm.startBroadcast(pk);
        BatchPayout payout = new BatchPayout();
        vm.stopBroadcast();
        console2.log("BatchPayout", address(payout));
    }
}

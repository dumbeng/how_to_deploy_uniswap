'use strict';
const fs = require('fs');
const HDWalletProvider = require('truffle-hdwallet-provider');
const Web3 = require("web3");

async function get_data() {
    return new Promise((resolve, reject) => {
        fs.readFile('../installation_data.json', (err, data) => {
            if (err) reject(err);
            resolve(JSON.parse(data));
        });
    });
}

async function write_data(_message) {
    return new Promise((resolve, reject) => {
        fs.writeFile('../installation_data.json', JSON.stringify(_message, null, 2), (err) => {
            if (err) reject(err);
            console.log('Data written to file');
            resolve();
        });
    });
}

async function deployContract(web3, bytecode, abi, args, from, gasPrice) {
    let contract = new web3.eth.Contract(abi);
    let deploy = contract.deploy({ data: bytecode, arguments: args });
    let gas = await deploy.estimateGas({ from: from });
    let newContractInstance = await deploy.send({ from: from, gas, gasPrice });
    console.log(`Contract deployed at address: ${newContractInstance.options.address}`);
    return newContractInstance.options.address;
}

(async () => {
    const data = await get_data();
    const provider = new HDWalletProvider([data.private_key.alice, data.private_key.bob, data.private_key.charlie], data.provider.rpc_endpoint);
    const web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    const gasPrice = await web3.eth.getGasPrice();
    const fromAccount = accounts[2]; // Assuming the first account is used for deployment

    // Deploy Uniswap V2 Factory
    const uniswapV2FactoryAddress = await deployContract(
      web3, data.bytecode.uniswap_v2_factory, data.abi.uniswap_v2_factory, [fromAccount], fromAccount, gasPrice
    );
    data.contract_address.uniswap_v2_factory = uniswapV2FactoryAddress;

    // Deploy WETH
    const wethAddress = await deployContract(
      web3, data.bytecode.weth, data.abi.weth, [], fromAccount, gasPrice
    );
    data.contract_address.weth = wethAddress;

    // Deploy Router
    const routerAddress = await deployContract(
      web3, data.bytecode.router, data.abi.router, [uniswapV2FactoryAddress, wethAddress], fromAccount, gasPrice
    );
    data.contract_address.router = routerAddress;

    // Deploy Multicall
    const multicallAddress = await deployContract(
      web3, data.bytecode.multicall, data.abi.multicall, [], fromAccount, gasPrice
    );
    data.contract_address.multicall = multicallAddress;

    // Deploy Migrator
    const migratorAddress = await deployContract(
      web3, data.bytecode.migrator, data.abi.migrator, [uniswapV2FactoryAddress, routerAddress], fromAccount, gasPrice
    );
    data.contract_address.migrator = migratorAddress;

    // Deploy ENS Registry
    const ensRegistryAddress = await deployContract(
      web3, data.bytecode.ens_registry, data.abi.ens_registry, [fromAccount], fromAccount, gasPrice
    );
    data.contract_address.ens_registry = ensRegistryAddress;

    // Deploy Gas Relay Hub Address
    const gasRelayHubAddress = await deployContract(
      web3, data.bytecode.gas_relay_hub_address, data.abi.gas_relay_hub_address, [], fromAccount, gasPrice
    );
    data.contract_address.gas_relay_hub_address = gasRelayHubAddress;

    // Update the installation data file with new contract addresses
    await write_data(data);

    // Clean up the provider
    provider.engine.stop();
})();

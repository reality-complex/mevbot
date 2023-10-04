const { Web3 } = require("web3");
require('dotenv').config();

var url = `wss://linea-mainnet.infura.io/ws/v3/${process.env.INFURA_KEY}`;
var provider = new Web3.providers.WebsocketProvider(url);
var web3 = new Web3(provider);

// Specify your wallet address and initial capital
const walletAddress = process.env.WALLET_ADDRESS;
let availableCapital = 0.5; // Adjust this value to your desired initial capital

// Create a memoization map for gas prices
const gasPriceCache = new Map();

// Start listening for pending transactions
web3.eth.subscribe('newPendingTransactions', async (error, txHash) => {
    if (error) {
        console.error(error);
        return;
    }

    // Get the transaction details
    const tx = await web3.eth.getTransaction(txHash);
    console.log(tx)

    // Check if the transaction is from your wallet
    if (tx.from.toLowerCase() === walletAddress.toLowerCase()) {
        // Calculate the transaction cost in ETH
        const txCostEth = web3.utils.fromWei((tx.gasPrice * tx.gas).toString(), 'ether');

        // Check if the transaction cost is less than the available capital
        if (txCostEth < availableCapital) {
            // Estimate the gas price required for a profitable replacement transaction
            const gasPrice = await getGasPrice();

            function calculateNewGasPrice(currentGasPrice) {
                const increasePercentage = 5; // Adjust this based on your desired increase rate
                const maxGasPrice = 1000; // Set a maximum gas price limit (in Gwei)

                const newGasPrice = Math.min(currentGasPrice * (1 + increasePercentage / 100), maxGasPrice);

                return newGasPrice;
            }

            const newGasPrice = calculateNewGasPrice(currentGasPrice);

            const newTxCostEth = web3.utils.fromWei((newGasPrice * tx.gas).toString(), 'ether');

            const profitMargin = availableCapital - newTxCostEth;

            // Check if the profit margin is positive

            if (profitMargin > 0) {
                // Create a new transaction with the same details but higher gas price
                const newTx = {
                    ...tx,
                    gasPrice: newGasPrice,
                };

                // Sign the new transaction with your private key
                const signedTx = await web3.eth.accounts.signTransaction(
                    newTx,
                    process.env.PRIVATE_KEY
                );

                // Send the signed transaction
                const receipt = await web3.eth.sendSignedTransaction(
                    signedTx.rawTransaction
                );

                console.log('Replaced transaction:', receipt.transactionHash);

                // Update the available capital
                availableCapital -= newTxCostEth;
                availableCapital += profitMargin;
                console.log('Updated available capital:', availableCapital);
            }
        }
    }
});

/**
 * Fetches and returns the current gas price from the network.
 * Implements memoization to cache gas prices for future use.
 * @returns {Promise<number>} The gas price in Wei.
 */
async function getGasPrice() {
    // Check if the gas price is already cached
    if (gasPriceCache.has('latest')) {
        return gasPriceCache.get('latest');
    }

    // Fetch the latest gas price from the network
    const gasPrice = await web3.eth.getGasPrice();

    // Cache the gas price
    gasPriceCache.set('latest', gasPrice);
    console.log(gasPrice)

    return gasPrice;
}

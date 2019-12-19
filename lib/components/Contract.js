const shell = require('shelljs')
const fs = require('fs')
const path = require('path')
const logger = require('./logger')

class Contract {

  constructor(web3, contractName) {
    this.web3 = web3.http
    this.chainId = process.env.CHAIN_ID || 2018
    this.contractName = contractName
    this.abi = ''
    this.bytecode = ''
    this.contract = null
    this.contractAddress = process.env.PROXY_CONTRACT_ADDRESS
    this.publicKey = this.web3.utils.toChecksumAddress(process.env.PUBLIC_KEY)
    this.privateKey = process.env.PRIVATE_KEY

    this.init()
  }

  init() {
    this.readContract(this.contractName)
      .then(contract => {
        this.abi = contract.abi
        this.bytecode = contract.bytecode
        this.contract = new this.web3.eth.Contract(contract.abi, this.contractAddress)
      })
      .catch(console.log)
  }

  readContract(contract) {
    return new Promise((resolve, reject) => {
      try {
        const abiPath = path.resolve(path.join(`./lib/contracts/${contract}.abi`))
        const bytecodePath = path.resolve(path.join(`./lib/contracts/${contract}.bin`))
        const abiFile = fs.readFileSync(abiPath, 'utf8');
        const bytecodeFile = fs.readFileSync(bytecodePath, 'utf8');
        const abi = JSON.parse(abiFile)
        const bytecode = `0x${bytecodeFile}`
        return resolve({ abi, bytecode});
      } catch (error) {
        return reject(error);
      }
    })
  }

  getNonce() {
  return new Promise((resolve, reject) => {
    Promise.all([
      this.web3.eth.txpool.content(),
      this.web3.eth.getTransactionCount(this.publicKey, 'pending')
    ])
      .then(data => {
        const txpool = data[0]
        let transactionCount = data[1]
        if(txpool.pending) {
          if(txpool.pending[this.publicKey]) {
            const pendingNonces = Object.keys(txpool.pending[this.publicKey])
            transactionCount = parseInt(pendingNonces[pendingNonces.length-1])+1
          }
        }
        logger.debug(`Nounce: ${transactionCount}`)
        resolve(transactionCount)
      })
      .catch(reject)
  })
}

timeout() {
  return new Promise((resolve, reject) => {
    setTimeout(()=>{
      resolve('timeout')
    }, parseInt(process.env.TRANSACTION_TIMEOUT || 10000))
  })
}

getPendingHash(nonce) {
  return new Promise((resolve, reject) => {
    this.web3.eth.txpool.content()
      .then(txpool => {
        if(txpool.pending) {
          if(txpool.pending[this.publicKey]) {
            if(txpool.pending[this.publicKey][`${nonce}`]) {
              let pendingTransaction = txpool.pending[this.publicKey][`${nonce}`]
              resolve(pendingTransaction.hash)
            } else {
              reject(`No pending transaction found for ${this.publicKey} at nonce ${nonce}`)
            }

          } else {
            reject(`No pending transaction found for ${this.publicKey}`)
          }
        } else {
          reject('No pending transactions found')
        }
      })
      .catch(reject)
  })
}

sendSignedTransaction(signedTransaction) {
  return new Promise((resolve, reject) => {
    this.web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
      .then(resolve)
      .catch(reject)
  })
}

generateTransactionParams(payload) {
  return new Promise((resolve, reject) => {
    Promise.all([
      this.web3.eth.getGasPrice(),
      this.getNonce()
    ])
    .then(data => {
      const gasPrice = data[0]
      const nonce = data[1]
      const transactionParams = {
        chainId: this.chainId,
        nonce,
        gasPrice: this.web3.utils.toHex(gasPrice),
        gasLimit: '0x47b760',
        to: this.contractAddress,
        from: this.publicKey,
        value: this.web3.utils.toHex(0),
        data: payload
      }
      resolve({transactionParams, nonce})
    })
    .catch(reject)
  })
}

signTransaction(transactionParams) {
  return new Promise((resolve, reject) => {
    this.web3.eth.accounts.signTransaction(transactionParams, this.privateKey)
      .then(resolve)
      .then(reject)
  })
}

sendTransactionAndRaceTimeout(signedTransaction,) {
  return new Promise((resolve, reject) => {
    Promise.race([
      this.sendSignedTransaction(signedTransaction),
      this.timeout()
      ])
      .then(resolve)
      .catch(reject)
  })
}

resolveTimedOutSetTransaction(nonce) {
  return new Promise((resolve, reject) => {
    logger.debug('Resolving timed out transaction')
    this.getPendingHash(nonce)
    .then(data => {
      const transactionHash = data[0]
      const doc = data[1]
      if(doc) {
        doc.success = false
        doc.transactionHash = transactionHash
        doc.save()
      }
      logger.debug(`Found transaction hash: ${transactionHash}`)
      return resolve(transactionHash);
    })
    .catch(error => {
      logger.debug(`Error finding transaction hash for nonce: ${nonce}`)
      resolve('nullPending')
    })
  })
}

async sendTransaction(payload) {
  return new Promise( async(resolve, reject) => {
    try {
      const data = await this.generateTransactionParams(payload)
      const {nonce, transactionParams} = data
      const signedTransaction = await this.signTransaction(transactionParams, this.privateKey)
      const receipt = await this.sendTransactionAndRaceTimeout(signedTransaction)
      if(receipt === 'timeout') {
        logger.debug(`Timedout waiting for transaction receipt`)
        const transactionHash = await this.resolveTimedOutSetTransaction(data.nonce)
        resolve({type: 'hash', data: transactionHash})
      } else {
        logger.debug(`Got transaction receipt, hash ${receipt.transactionHash}`)
        resolve({type: 'receipt', data: receipt})
      }
    } catch (error) {
      reject(error)
    }
  })
}

  compile(contract) {
    console.log(`Compiling ${contract}.sol`)
    const cmd = `solc --overwrite --gas --bin --abi --optimize-runs=200 -o ./lib/contracts/ ./lib/contracts/${contract}.sol`
    const output = shell.exec(cmd, {async:true})
    output.stdout.on('data', console.log);
  }

  deploy(address) {
    return new Promise((resolve, reject) => {
      try {
        const encodedABI = this.contract.deploy({data: this.bytecode, arguments: [address] }).encodeABI()
        Promise.all([
          this.web3.eth.getGasPrice(),
          this.web3.eth.getTransactionCount(process.env.PUBLIC_KEY, 'pending')
        ])
        .then(data => {
          const gasPrice = data[0]
          const nonce = data[1]
          const transactionParams = {
            chainId: 2018,
            nonce,
            gasPrice: this.web3.utils.toHex(gasPrice),
            gasLimit: '0x47b760',
            from: this.publicKey,
            value: this.web3.utils.toHex(0),
            data: encodedABI,
          }
          logger.info(`Signing transaction with privateKey: ${process.env.PRIVATE_KEY}`)
          this.web3.eth.accounts.signTransaction(transactionParams, process.env.PRIVATE_KEY)
            .then(signedTransaction => {
              logger.info('Sending signed transaction')
              this.web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
                .then(receipt => {
                  resolve(receipt)
                  logger.info(`Transaction complete on block ${receipt.blockNumber}, with transaction hash ${receipt.transactionHash}`)
                  if(receipt.contractAddress) {
                    logger.info(`Contract created at address ${receipt.contractAddress}`)
                  }
                })
                .catch(reject)
            })
            .catch(reject)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  deployGeneric(abi, bytecode) {
    return new Promise((resolve, reject) => {
      try {
        abi = JSON.parse(abi)
        const contract = new this.web3.eth.Contract(abi)
        const encodedABI = contract.deploy({data: bytecode}).encodeABI()
        Promise.all([
          this.web3.eth.getGasPrice(),
          this.web3.eth.getTransactionCount(process.env.PUBLIC_KEY, 'pending')
        ])
        .then(data => {
          const gasPrice = data[0]
          const nonce = data[1]
          const transactionParams = {
            chainId: 2018,
            nonce,
            gasPrice: this.web3.utils.toHex(gasPrice),
            gasLimit: '0x47b760',
            from: this.publicKey,
            value: this.web3.utils.toHex(0),
            data: encodedABI,
          }
          logger.info(`Signing transaction with privateKey: ${process.env.PRIVATE_KEY}`)
          this.web3.eth.accounts.signTransaction(transactionParams, process.env.PRIVATE_KEY)
            .then(signedTransaction => {
              logger.info('Sending signed transaction')
              this.web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
                .then(receipt => {
                  resolve(receipt)
                  logger.info(`Transaction complete on block ${receipt.blockNumber}, with transaction hash ${receipt.transactionHash}`)
                  if(receipt.contractAddress) {
                    logger.info(`Contract created at address ${receipt.contractAddress}`)
                  }
                })
                .catch(reject)
            })
            .catch(reject)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  transferProxyOwnership(address) {
    return new Promise((resolve, reject) => {
      const encodedABI = this.contract.methods.transferProxyOwnership(address).encodeABI()
      this.sendTransaction(encodedABI)
        .then(resolve)
        .catch(reject)
    })
  }

  upgradeTo(newContractAddress) {
    return new Promise((resolve, reject) => {
      const encodedABI = this.contract.methods.upgradeTo(newContractAddress).encodeABI()
      this.sendTransaction(encodedABI)
        .then(resolve)
        .catch(reject)
    })
  }

  upgradeToAndCall(newContractAddress, data) {
    return new Promise((resolve, reject) => {
      const encodedABI = this.contract.methods.upgradeToAndCall(newContractAddress, data).encodeABI()
      this.sendTransaction(encodedABI)
        .then(resolve)
        .catch(reject)
    })
  }

  implementation() {
    return new Promise((resolve, reject) => {
      this.contract.methods.implementation().call()
      .then(resolve)
      .catch(reject)
    })
  }

  proxyOwner() {
    return new Promise((resolve, reject) => {
      this.contract.methods.proxyOwner().call()
      .then(resolve)
      .catch(reject)
    })
  }

}


module.exports = Contract

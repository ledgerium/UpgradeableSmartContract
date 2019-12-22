const express = require('express')
const router = express.Router()

const Web3 = require('../../components/Web3')
const Contract = require('../../components/Contract')

const logger = require('../../components/logger')

const web3 = new Web3()
const contract = new Contract(web3, 'OwnedUpgradeabilityProxy')

router.get('/', (request, response) => {
  response.send('Hello')
})

router.get('/balance', (request, response) => {
  web3.http.eth.getBalance(process.env.PUBLIC_KEY)
  .then(data => {
      response.send({
        success: true,
        timestamp: Date.now(),
        data
      })
    })
    .catch(error => {
      logger.error(error.message)
      response.send({
        success: false,
        timestamp: Date.now(),
        data: error.message
      })
    })
  })

router.get('/transaction/:hash', (request, response) => {
  const {hash} = request.params
  web3.http.eth.getTransactionReceipt(hash)
    .then(data => {
      response.send({
        success: true,
        timestamp: Date.now(),
        data
      })
    })
    .catch(error => {
      logger.error(error.message)
      response.send({
        success: false,
        timestamp: Date.now(),
        data: error.message
      })
    })
  })


router.get('/deploy/to/:address', (request, response) => {
  const { address } = request.params
  contract.deploy(address)
  .then(data => {
    response.send({
      success: true,
      timestamp: Date.now(),
      data
    })
  })
  .catch(error => {
    logger.error(error.message)
    response.send({
      success: false,
      timestamp: Date.now(),
      data: error.message
    })
  })
})

router.post('/deploy/new', (request, response) => {
  const { abi, bytecode } = request.body
  contract.deployGeneric(abi, bytecode)
  .then(data => {
    response.send({
      success: true,
      timestamp: Date.now(),
      data
    })
  })
  .catch(error => {
    logger.error(error.message)
    response.send({
      success: false,
      timestamp: Date.now(),
      data: error.message
    })
  })
})

router.get('/upgrade/to/:newAddress', async (request, response) => {
  const oldAddress = await contract.implementation()
  const { newAddress } = request.params
  contract.upgradeTo(newAddress)
    .then(data => {
      response.send({
        success: true,
        timestamp: Date.now(),
        data
      })
    })
    .catch(error => {
      logger.error(error.message)
      response.send({
        success: false,
        timestamp: Date.now(),
        data: error.message
      })
    })
  })

  router.get('/ownership/to/:newAddress', async (request, response) => {
    const { newAddress } = request.params
    contract.transferProxyOwnership(newAddress)
    .then(data => {
      response.send({
        success: true,
        timestamp: Date.now(),
        data
      })
    })
    .catch(error => {
      logger.error(error.message)
      response.send({
        success: false,
        timestamp: Date.now(),
        data: error.message
      })
    })
  })


router.get('/contract', (request, response) => {
  contract.implementation()
    .then(data => {
      response.send({
        success: true,
        timestamp: Date.now(),
        data
      })
    })
    .catch(error => {
      logger.error(error.message)
      response.send({
        success: false,
        timestamp: Date.now(),
        data: error.message
      })
    })
  })

router.get('/proxyOwner', (request, response) => {
  contract.proxyOwner()
    .then(data => {
      response.send({
        success: true,
        timestamp: Date.now(),
        data
      })
    })
    .catch(error => {
      logger.error(error.message)
      response.send({
        success: false,
        timestamp: Date.now(),
        data: error.message
      })
    })
  })

module.exports = router

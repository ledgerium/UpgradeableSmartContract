const express = require('express')
const router = express.Router()

const Web3 = require('../../components/Web3')
const Contract = require('../../components/Contract')

const web3 = new Web3()
const contract = new Contract(web3, 'OwnedUpgradeabilityProxy')

router.get('/', (request, response) => {
  response.send('Hello')
})

router.get('/balance', (request, response) => {
  web3.http.eth.getBalance(process.env.PUBLIC_KEY)
    .then(balance => {
      response.send(balance)
    })
    .catch(console.log)
})

router.get('/transaction/:hash', (request, response) => {
  const {hash} = request.params
  web3.http.eth.getTransactionReceipt(hash)
    .then(tx => {
      response.send(tx)
    })
    .catch(console.log)
})


router.get('/deploy/to/:address', (request, response) => {
  const { address } = request.params
  contract.deploy(address)
  .then(data => {
    response.send(data)
  })
  .catch(console.log)
})

router.post('/deploy/new', (request, response) => {
  const { abi, bytecode } = request.body
  contract.deployGeneric(abi, bytecode)
})

router.get('/upgrade/to/:newAddress', async (request, response) => {
  const oldAddress = await contract.implementation()
  const { newAddress } = request.params
  console.log(newAddress)
  contract.upgradeTo(newAddress)
    .then(console.log)
    .catch(console.log)

})

router.get('/contract', (request, response) => {
  contract.implementation()
    .then(data => {
      response.send(data)
    })
    .catch(console.log)
})

router.get('/proxyOwner', (request, response) => {
  contract.proxyOwner()
    .then(data => {
      response.send(data)
    })
    .catch(console.log)
})

router.get('/test', (request, response) => {

})

// router.get('/:contractName', (request, response) => {
//   const { contractName } = request.params
//   contract.compile(contractName)
//   response.send('Compiling, check terminal')
// })

module.exports = router

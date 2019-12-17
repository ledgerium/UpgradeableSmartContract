const express = require('express')
const router = express.Router()

const Web3 = require('../components/Web3')
const Contract = require('../components/Contract')

const web3 = new Web3()
const contract = new Contract(web3, 'OwnedUpgradeabilityProxy')

router.get('/', (request, response) => {
  response.send('Hello')
})
//
// router.get('/deploy', (request, response) => {
//   response.send('Deplying... check terminal')
//   contract.deploy()
// })

router.get('/upgrade/to/:newAddress', async (request, response) => {
  const oldAddress = await contract.implementation()
  const { newAddress } = request.params
  contract.upgradeTo(newAddress)
    .then(console.log)
    .catch(console.log)

})

router.get('/contract', (request, response) => {
  contract.implementation()
    .then(console.log)
    .catch(console.log)
})

router.get('/proxyOwner', (request, response) => {
  contract.proxyOwner()
    .then(console.log)
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

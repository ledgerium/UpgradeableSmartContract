const express = require('express')
const router = express.Router()

router.use('/api', require('./api'))

router.get('/', (request, response) => {
  response.render('home')
})

module.exports = router

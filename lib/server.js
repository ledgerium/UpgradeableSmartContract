const express = require('express')
const path = require('path')
const handlebars  = require('express-handlebars');
const cors = require('cors')
const helmet = require('helmet')
const socket = require('ws')

const viewsPath = path.join(__dirname, '/views');

const hbs = handlebars.create({
  defaultLayout: 'main',
  layoutsDir: viewsPath + '/layouts',
  partialsDir: viewsPath
});

const logger = require('./components/logger')
// const database = require('./components/database')

const app = express()
const port = process.env.SERVER_PORT || 5077

const server = app.listen(port, () => {
  logger.info(`Listening on port: ${port}`)
  app.use(express.json())
  app.use(helmet())
  app.use(cors())
  app.set('views', viewsPath);
  app.engine('handlebars', hbs.engine);
  app.set('view engine', 'handlebars');
  app.use('/', require('./routes'))
})

module.exports = new socket.Server({server})

import { schema } from './graphql'
import { appVersion } from './config/version'
import { ApolloServer } from 'apollo-server-express'
import { json } from 'body-parser'
import cors from 'cors'
import express from 'express'
import compression from 'compression'
import user from './api/user'
import * as http from 'http'

const apollo = new ApolloServer({ schema })
const app = express()
  .use(compression())
  .use(cors())
  .use('/time', (req, res) => {
    res.end(`{"time": ${new Date().getTime()}}`)
  })
  .use('/check', (req, res) => {
    res.end('{online: true}')
  })
  .use('/version', (req, res) => {
    res.end(`{"version": "${appVersion}"}`)
  })
  .use('/v6', json())

user(app)

apollo.applyMiddleware({ app, path: '/graphql' })

http.createServer(app).listen(4000)

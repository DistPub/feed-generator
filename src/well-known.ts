import express from 'express'
import { AppContext } from './config'

const makeRouter = (ctx: AppContext) => {
  const router = express.Router()

  router.get('/.well-known/did.json', (_req, res) => {
    if (!ctx.cfg.serviceDid.endsWith(ctx.cfg.hostname)) {
      return res.sendStatus(404)
    }
    res.json({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: ctx.cfg.serviceDid,
      service: [
        {
          id: '#bsky_fg',
          type: 'BskyFeedGenerator',
          serviceEndpoint: `https://${ctx.cfg.hostname}`,
        },
      ],
    })
  })
  router.get('/trending', (_, res) => {
    res.sendFile(process.cwd() + '/public/trending.html');
  });
  router.get('/report', (_, res) => {
    res.sendFile(process.cwd() + '/public/report.html');
  });
  router.get('/label', (_, res) => {
    res.sendFile(process.cwd() + '/public/label.html');
  });

  return router
}
export default makeRouter

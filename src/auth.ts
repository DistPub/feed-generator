import express from 'express'
import { verifyJwt, AuthRequiredError, parseReqNsid } from '@atproto/xrpc-server'
import { DidResolver } from '@atproto/identity'

export const validateAuth = async (
  req: express.Request,
  serviceDid: string,
  didResolver: DidResolver,
): Promise<string> => {
  let authorization = ''
  if (req.headers['x-bsky-topics']) {
    authorization = req.headers['x-bsky-topics'] as string
  } else if (req.headers['authorization']) {
    authorization = req.headers['authorization'] as string
  }

  if (!authorization) {
    throw new AuthRequiredError('anonymous')
  }

  if (!authorization.startsWith('Bearer ')) {
    throw new AuthRequiredError('Not a Bearer token')
  }
  const jwt = authorization.replace('Bearer ', '').trim()
  const nsid = parseReqNsid(req)
  const parsed = await verifyJwt(jwt, serviceDid, nsid, async (did: string) => {
    return didResolver.resolveAtprotoKey(did)
  })
  return parsed.iss
}

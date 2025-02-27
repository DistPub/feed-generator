export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  mod_image_post: ModImagePost
  report_image_post: ReportImagePost
}

export type Post = {
  uri: string
  cid: string
  indexedAt: string
}

export type SubState = {
  service: string
  cursor: number
}

export type ModImagePost = {
  uri: string
  cid: string
  indexedAt: string
  author: string
  imgUrls: string
}

export type ReportImagePost = {
  uri: string
  cid: string
  indexedAt: string
  author: string
  imgUrls: string
}

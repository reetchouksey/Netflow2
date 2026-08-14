const { S3Client, ListObjectsV2Command, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const getClient = (org) => {
  const s3 = org?.integrations?.s3
  if (!s3 || !s3.enabled) return null
  if (!s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) return null

  const config = {
    region: s3.region || 'auto',
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey
    }
  }

  if (s3.endpoint) {
    config.endpoint = s3.endpoint
  }

  return new S3Client(config)
}

const listFolder = async (org, prefix = '') => {
  const client = getClient(org)
  if (!client) throw new Error('S3 is not configured for this organization')
  
  const bucket = org.integrations.s3.bucket
  if (prefix && !prefix.endsWith('/')) prefix += '/'

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: '/'
  })

  const res = await client.send(command)
  
  const folders = (res.CommonPrefixes || []).map(p => {
    const raw = p.Prefix
    const name = raw.slice(prefix.length, -1)
    return { name, path: raw, type: 'folder' }
  })

  const files = (res.Contents || [])
    .filter(c => c.Key !== prefix)
    .map(c => {
      const name = c.Key.slice(prefix.length)
      return {
        name,
        path: c.Key,
        type: 'file',
        size: c.Size,
        lastModified: c.LastModified
      }
    })

  return { folders, files }
}

const getPresignedUploadUrl = async (org, key, contentType) => {
  const client = getClient(org)
  if (!client) throw new Error('S3 is not configured for this organization')
  
  const command = new PutObjectCommand({
    Bucket: org.integrations.s3.bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream'
  })

  return await getSignedUrl(client, command, { expiresIn: 3600 })
}

const getPresignedDownloadUrl = async (org, key) => {
  const client = getClient(org)
  if (!client) throw new Error('S3 is not configured for this organization')
  
  const command = new GetObjectCommand({
    Bucket: org.integrations.s3.bucket,
    Key: key
  })

  return await getSignedUrl(client, command, { expiresIn: 3600 })
}

const uploadFile = async (org, key, buffer, contentType) => {
  const client = getClient(org)
  if (!client) throw new Error('S3 is not configured for this organization')
  
  const command = new PutObjectCommand({
    Bucket: org.integrations.s3.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream'
  })

  return await client.send(command)
}

const deleteFile = async (org, key) => {
  const client = getClient(org)
  if (!client) throw new Error('S3 is not configured for this organization')
  
  const command = new DeleteObjectCommand({
    Bucket: org.integrations.s3.bucket,
    Key: key
  })

  return await client.send(command)
}

// Returns true when the org has a complete, enabled S3 config.
// Used by upload routes to decide whether to route files to S3.
const isEnabled = (org) => {
  const s3 = org?.integrations?.s3
  if (!s3 || !s3.enabled) return false
  return Boolean(s3.bucket && s3.accessKeyId && s3.secretAccessKey)
}

module.exports = {
  getClient,
  isEnabled,
  listFolder,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  uploadFile,
  deleteFile
}

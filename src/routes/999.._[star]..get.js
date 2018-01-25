import bunyan from 'bunyan'
import RedisHelper from '../libs/RedisHelper'
import GeoIp from '../libs/GeoIp'
import Slack from '../libs/Slack'
import ChartExamples from '../libs/ChartExamples'
import config from '../config'

const redisClient = new RedisHelper()
const log = bunyan.createLogger(config.logger.options)

export default async function Index(req, res) {
  try {
    res.render('index', {
      data: {
        host: config.server.host,
        types: ChartExamples
      }
    })


    let realClientIpAddress = (req.headers['x-forwarded-for'] || req.ip).split(',')
    realClientIpAddress = realClientIpAddress[realClientIpAddress.length - 1]
    const redisCacheKey = `ip_recent_${realClientIpAddress}`
    const currentCache = await redisClient.get(redisCacheKey)
    if (currentCache) {
      await redisClient.set(redisCacheKey, 'true', { ttl: 60 * 10 })
    } else {
      const location = await GeoIp.location(realClientIpAddress)
      await Slack.send(`Someone visited the landing page -- IP: ${realClientIpAddress} (location: ${location.city}, ${location.region_code}, ${location.country_name}), hostname: ${req.hostname}, User-Agent: ${req.headers['user-agent']}`)
      await redisClient.set(redisCacheKey, 'true', { ttl: 60 * 10 })
    }
  } catch(err) {
    log.error("Error sending slack message", err)
  }
}

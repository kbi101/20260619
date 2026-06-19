package com.quantstation.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis configuration for low-latency state lookups.
 *
 * <p>Redis stores volatile live state:
 * <ul>
 *   <li>Active positions and PnL</li>
 *   <li>Greeks matrix for option chains</li>
 *   <li>Active orders and their current status</li>
 *   <li>Last prices and spreads</li>
 * </ul>
 *
 * <p>Uses Lettuce (async, non-blocking) with JSON serialization.
 * Connection pool is configured in application.yml.
 */
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // String keys for readability in redis-cli
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // JSON values for structured data
        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer();
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.setEnableDefaultSerializer(false);
        template.afterPropertiesSet();
        return template;
    }
}

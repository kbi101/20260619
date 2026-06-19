package com.quantstation.config;

import org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration;
import org.springframework.boot.web.embedded.tomcat.TomcatProtocolHandlerCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;

import java.util.concurrent.Executors;

/**
 * Configures Virtual Threads (Project Loom) for the entire application.
 *
 * <p>Virtual threads are used for:
 * <ul>
 *   <li>Tomcat request handling (HTTP + WebSocket upgrade)</li>
 *   <li>Async task execution (@Async methods)</li>
 *   <li>Market data fan-out and UI push operations</li>
 * </ul>
 *
 * <p><strong>Note:</strong> The hot trading path (OMS → RiskManager → IbkrOrderRouter)
 * uses dedicated platform threads to minimize GC jitter on the critical execution path.
 */
@Configuration
public class VirtualThreadConfig {

    /**
     * Override Tomcat's default thread pool with virtual threads.
     * Each incoming connection gets its own lightweight virtual thread.
     */
    @Bean
    TomcatProtocolHandlerCustomizer<?> protocolHandlerVirtualThreadCustomizer() {
        return protocolHandler ->
                protocolHandler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    }

    /**
     * Replace the application-wide async task executor with virtual threads.
     * All @Async methods will run on virtual threads.
     */
    @Bean(TaskExecutionAutoConfiguration.APPLICATION_TASK_EXECUTOR_BEAN_NAME)
    AsyncTaskExecutor applicationTaskExecutor() {
        return new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
    }
}

plugins {
    java
    id("org.springframework.boot") version "3.4.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.quantstation"
version = "0.1.0-SNAPSHOT"
description = "QuantStation Core Engine — Ultra-low latency trading backend"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // ── Spring Boot Starters ──────────────────────────
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-web")

    // ── Redis (Lettuce — low-latency async) ───────────
    implementation("io.lettuce:lettuce-core")

    // ── QuestDB ILP Client (tick ingestion) ───────────
    implementation("org.questdb:questdb:8.2.1")

    // ── Jackson (JSON serialization) ──────────────────
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")

    // ── WebSocket STOMP ───────────────────────────────
    implementation("org.springframework:spring-messaging")

    // ── Logging ───────────────────────────────────────
    implementation("ch.qos.logback:logback-classic")

    // ── Testing ───────────────────────────────────────
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// ── Virtual Threads (Java 21 Loom) ────────────────────
tasks.withType<JavaCompile> {
    options.compilerArgs.addAll(listOf("--enable-preview"))
}

tasks.withType<JavaExec> {
    jvmArgs("--enable-preview")
}

springBoot {
    mainClass.set("com.quantstation.QuantStationApp")
}

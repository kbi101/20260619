# ── Build Stage ──
FROM eclipse-temurin:21 AS build
WORKDIR /app

# Copy gradle wrapper and config files
COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts .
COPY settings.gradle.kts .

# Download dependencies (cache layer)
RUN ./gradlew dependencies --no-daemon || true

# Copy source code and build jar
COPY src src
RUN ./gradlew bootJar --no-daemon

# ── Runtime Stage ──
FROM eclipse-temurin:21
WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Expose server and actuator ports
EXPOSE 8080 8081

# Run with virtual threads preview enabled
ENTRYPOINT ["java", "--enable-preview", "-jar", "app.jar"]

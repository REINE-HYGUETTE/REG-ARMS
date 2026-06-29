# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
# Cache dependencies first
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
# Build the app
COPY src ./src
RUN mvn -q -B clean package -DskipTests

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Hosts inject PORT; the app reads it via ${PORT:8080}. Cap heap for 512MB tiers.
ENV JAVA_TOOL_OPTIONS="-Xmx400m -XX:+UseSerialGC"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

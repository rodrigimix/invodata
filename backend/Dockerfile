FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -Dmaven.test.skip=true package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN apt-get update && apt-get install -y openssl docker.io docker-compose \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/target/*.jar /app/app.jar
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]

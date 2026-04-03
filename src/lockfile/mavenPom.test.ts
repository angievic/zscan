import { describe, expect, it } from "vitest";
import { parseMavenPomDependencies } from "./mavenPom.js";

describe("parseMavenPomDependencies", () => {
  it("parses literal versions", () => {
    const text = `
<project>
  <dependencies>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>lib</artifactId>
      <version>1.2.3</version>
    </dependency>
  </dependencies>
</project>
`;
    expect(parseMavenPomDependencies(text)).toContainEqual({
      name: "com.example:lib",
      version: "1.2.3",
    });
  });

  it("resolves version from properties", () => {
    const text = `
<project>
  <properties>
    <jackson.version>2.15.2</jackson.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
      <version>\${jackson.version}</version>
    </dependency>
  </dependencies>
</project>
`;
    expect(parseMavenPomDependencies(text)).toContainEqual({
      name: "com.fasterxml.jackson.core:jackson-databind",
      version: "2.15.2",
    });
  });

  it("omits dependency when property is unresolved", () => {
    const text = `
<project>
  <dependencies>
    <dependency>
      <groupId>a</groupId>
      <artifactId>b</artifactId>
      <version>\${missing.prop}</version>
    </dependency>
  </dependencies>
</project>
`;
    expect(parseMavenPomDependencies(text)).toHaveLength(0);
  });
});

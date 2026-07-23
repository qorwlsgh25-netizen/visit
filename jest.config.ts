import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Next.js 앱의 경로를 지정하여 설정 및 .env 파일을 테스트 환경에 로드합니다.
  dir: './',
});

// Jest에 전달할 사용자 정의 설정
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    // TypeScript 경로 별칭인 @/* 대응 설정
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default createJestConfig(config);

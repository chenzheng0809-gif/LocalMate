import type { AppDatabase } from "@/lib/db/client";
import { createProductRepository } from "@/lib/repositories/product-repository";
import { createJobRepository } from "@/lib/repositories/job-repository";
import { createResearchRepository } from "@/lib/repositories/research-repository";
import { createEvidenceRepository } from "@/lib/repositories/evidence-repository";
import { createComplianceRepository } from "@/lib/repositories/compliance-repository";
import { createMatchRepository } from "@/lib/repositories/match-repository";
import { createSimulationRepository } from "@/lib/repositories/simulation-repository";
import { createLaunchRepository } from "@/lib/repositories/launch-repository";
import { createPassportRepository } from "@/lib/repositories/passport-repository";
import { createUsageRepository } from "@/lib/repositories/usage-repository";
import { createCacheRepository } from "@/lib/repositories/cache-repository";
import { getDb } from "@/lib/db/client";

import { createObservationRepository } from "@/lib/localmate/observations";
import { createBenchmarkRepository } from "@/lib/localmate/benchmarks";
import { createBoardRepository } from "@/lib/localmate/board";
import { createMissionRepository } from "@/lib/localmate/repository";

import { createMethodRepository } from "@/lib/localmate/method-repository";
import { createTeamRepository } from "@/lib/localmate/team-repository";

export function createRepositories(db: AppDatabase) {
  const repositories = {
    benchmarks: createBenchmarkRepository(db),
    observations: createObservationRepository(db),
    team: createTeamRepository(db),
    methods: createMethodRepository(db),
    missions: createMissionRepository(db),
    products: createProductRepository(db),
    jobs: createJobRepository(db),
    research: createResearchRepository(db),
    evidence: createEvidenceRepository(db),
    compliance: createComplianceRepository(db),
    matches: createMatchRepository(db),
    simulations: createSimulationRepository(db),
    launch: createLaunchRepository(db),
    passports: createPassportRepository(db),
    usage: createUsageRepository(db),
    cache: createCacheRepository(db),
  };
  return { ...repositories, board: createBoardRepository(db, repositories) };
}

export type Repositories = ReturnType<typeof createRepositories>;

let singleton: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!singleton) {
    singleton = createRepositories(getDb());
  }
  return singleton;
}

export function resetRepositories(): void {
  singleton = null;
}
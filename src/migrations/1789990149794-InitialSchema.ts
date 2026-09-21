import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789990149794 implements MigrationInterface {
    name = 'InitialSchema1789990149794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."execution-logs_status_enum" AS ENUM('RUNNING', 'SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "execution-logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."execution-logs_status_enum" NOT NULL, "result_payload" jsonb, "error_message" text, "started_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP, "workflow_id" uuid, "node_id" character varying, CONSTRAINT "PK_242d3ccb64987caa1e2afb127bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "edge" ("id" character varying NOT NULL, "source" character varying NOT NULL, "target" character varying NOT NULL, "source_handle" character varying, "workflow_id" uuid, CONSTRAINT "PK_bf6f43c9af56d05094d8c57b311" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."nodes_type_enum" AS ENUM('TRIGGER', 'SCHEDULE', 'DELAY', 'EMAIL', 'CONDITION', 'WEBHOOK', 'HTTP_FETCH', 'VISION', 'REGEX')`);
        await queryRunner.query(`CREATE TABLE "nodes" ("id" character varying NOT NULL, "type" "public"."nodes_type_enum" NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "ui_position" jsonb NOT NULL DEFAULT '{}', "workflow_id" uuid, CONSTRAINT "PK_682d6427523a0fa43d062ea03ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "workflows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "status" "public"."workflows_status_enum" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_5b5757cc1cd86268019fef52e0c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "execution-logs" ADD CONSTRAINT "FK_fb1866feb514eaf451b1c677d5e" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "execution-logs" ADD CONSTRAINT "FK_3678efc2b94663e52e38eb7c9c5" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "edge" ADD CONSTRAINT "FK_bb7ed1dae61aae6479d724fc9d5" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nodes" ADD CONSTRAINT "FK_e787f08bd0e38aa2d4ad40ce951" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflows" ADD CONSTRAINT "FK_0a52180b1fead686fa874dcf951" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflows" DROP CONSTRAINT "FK_0a52180b1fead686fa874dcf951"`);
        await queryRunner.query(`ALTER TABLE "nodes" DROP CONSTRAINT "FK_e787f08bd0e38aa2d4ad40ce951"`);
        await queryRunner.query(`ALTER TABLE "edge" DROP CONSTRAINT "FK_bb7ed1dae61aae6479d724fc9d5"`);
        await queryRunner.query(`ALTER TABLE "execution-logs" DROP CONSTRAINT "FK_3678efc2b94663e52e38eb7c9c5"`);
        await queryRunner.query(`ALTER TABLE "execution-logs" DROP CONSTRAINT "FK_fb1866feb514eaf451b1c677d5e"`);
        await queryRunner.query(`DROP TABLE "workflows"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_status_enum"`);
        await queryRunner.query(`DROP TABLE "nodes"`);
        await queryRunner.query(`DROP TYPE "public"."nodes_type_enum"`);
        await queryRunner.query(`DROP TABLE "edge"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "execution-logs"`);
        await queryRunner.query(`DROP TYPE "public"."execution-logs_status_enum"`);
    }

}

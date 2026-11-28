import { LIMITS } from "../utils/inputLimits";

type OpenApiObject = Record<string, unknown>;

/** Core statuses every board keeps; boards may add further custom status slugs. */
const CORE_ISSUE_STATUS = ["backlog", "todo", "in-progress", "done"] as const;
const ISSUE_PRIORITY = ["low", "medium", "high", "urgent", "none"] as const;
const ISSUE_LABEL = ["General", "Bug", "Feature", "Improvement", "Docs", "Chore"] as const;
const ORGANIZATION_ROLE = ["owner", "admin", "member"] as const;
const INVITE_ROLE = ["admin", "member"] as const;
const INVITE_STATUS = ["pending", "accepted", "cancelled", "declined"] as const;
const RECORDING_STATUS = ["uploaded", "transcribing", "ready", "failed"] as const;
const RECORDING_AUDIO_MIME = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
] as const;

const cookieSecurity = [{ cookieAuth: [] }];
const organizationSecurity = [{ cookieAuth: [], organizationHeader: [] }];

function schemaRef(name: string): OpenApiObject {
  return { $ref: `#/components/schemas/${name}` };
}

function responseRef(name: string): OpenApiObject {
  return { $ref: `#/components/responses/${name}` };
}

function parameterRef(name: string): OpenApiObject {
  return { $ref: `#/components/parameters/${name}` };
}

function successEnvelope(dataSchema: OpenApiObject): OpenApiObject {
  return {
    type: "object",
    required: ["success", "data", "error"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: dataSchema,
      error: { type: "string", nullable: true, example: null },
    },
  };
}

function successResponse(
  description: string,
  dataSchema: OpenApiObject,
): OpenApiObject {
  return {
    description,
    content: {
      "application/json": {
        schema: successEnvelope(dataSchema),
      },
    },
  };
}

function jsonRequestBody(
  schema: OpenApiObject,
  required = true,
): OpenApiObject {
  return {
    required,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

function arrayOf(schemaName: string): OpenApiObject {
  return {
    type: "array",
    items: schemaRef(schemaName),
  };
}

function failureExample(error: string): OpenApiObject {
  return { value: { success: false, data: null, error } };
}

const optionalPreferredOrgHeader: OpenApiObject = {
  name: "X-Organization-Id",
  in: "header",
  required: false,
  description:
    "Optional preferred organization id. When valid and accessible, `/api/auth/me` returns it as `currentOrganizationId`.",
  schema: {
    type: "string",
    example: "507f191e810c19729de860ea",
  },
};

const issueListFilterParameters: OpenApiObject[] = [
  parameterRef("StatusFilterQuery"),
  parameterRef("PriorityFilterQuery"),
  parameterRef("LabelFilterQuery"),
  parameterRef("AssigneeFilterQuery"),
];

export const openApiSpec: OpenApiObject = {
  openapi: "3.0.3",
  info: {
    title: "Trackio API",
    version: "1.0.0",
    description: [
      "Interactive OpenAPI documentation for the Trackio backend.",
      "",
      "Auth model:",
      "- Login and register set the `trackio_token` httpOnly cookie.",
      "- Authenticated endpoints require that cookie (401 `Unauthorized` otherwise).",
      "- Organization-scoped endpoints also require the `X-Organization-Id` header (400 `Organization required` when missing/invalid, 403 `Forbidden` when the user is not a member).",
      "",
      "Response envelope: every JSON endpoint returns `{ success, data, error }` (the GitHub webhook returns `{ ok, error? }`).",
      "",
      "Cross-site protection: state-changing requests (POST/PATCH/PUT/DELETE) that send an `Origin` header not in the allowed frontend origins (or the API's own origin) are rejected with 403 `Request origin not allowed`. Requests without an `Origin` header (curl, server-to-server) are allowed.",
      "",
      "Rate limiting: limited routes return 429 `Too many requests. Try again later.` with a `Retry-After` header (seconds).",
      "",
      "Input limits (400 on violation): issue title ≤ 500 characters, issue description ≤ 100000, comment ≤ 10000, person/project/workspace names ≤ 100, emails must be valid (≤ 254).",
      "",
      "Tip: if you open these docs in the same browser session as the app, authenticated requests can reuse the existing cookie.",
    ].join("\n"),
  },
  servers: [
    {
      url: "/",
      description: "Current Trackio backend",
    },
  ],
  tags: [
    { name: "Auth", description: "Authentication, profile, password reset, and invite acceptance." },
    { name: "Organizations", description: "Workspace members, invites, issues board, and workspace settings." },
    { name: "Projects", description: "Project listing, creation, detail, settings, and project-scoped issues." },
    { name: "Issues", description: "Global issue listing, issue detail, comments, and attachments." },
    { name: "Sprints", description: "Workspace sprint information." },
    { name: "Transcriptions", description: "AI-assisted issue extraction from transcripts and audio recordings." },
    { name: "Integrations", description: "GitHub workspace integration endpoints and webhook receiver." },
    { name: "Uploads", description: "Multipart upload and GridFS-backed download for issue attachments and comments." },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "trackio_token",
        description:
          "Session cookie set by `POST /api/auth/login` and `POST /api/auth/register`.",
      },
      organizationHeader: {
        type: "apiKey",
        in: "header",
        name: "X-Organization-Id",
        description: "Workspace id required by organization-scoped routes.",
      },
    },
    headers: {
      RetryAfter: {
        description: "Seconds until the rate-limit window resets.",
        schema: { type: "integer", example: 42 },
      },
    },
    parameters: {
      TokenQuery: {
        name: "token",
        in: "query",
        required: true,
        description: "Invite preview token from the email link.",
        schema: {
          type: "string",
          example: "invite_token_here",
        },
      },
      SlugPath: {
        name: "slug",
        in: "path",
        required: true,
        description: "Project slug.",
        schema: {
          type: "string",
          example: "linear-architect",
        },
      },
      IssueIdPath: {
        name: "issueId",
        in: "path",
        required: true,
        description: "Issue display id such as `LA-1021`.",
        schema: {
          type: "string",
          example: "LA-1021",
        },
      },
      CommentIdPath: {
        name: "commentId",
        in: "path",
        required: true,
        description: "MongoDB id of the comment document.",
        schema: {
          type: "string",
          example: "507f1f77bcf86cd799439012",
        },
      },
      AttachmentIdPath: {
        name: "attachmentId",
        in: "path",
        required: true,
        description: "Issue attachment id (the `id` field of an `IssueAttachment`).",
        schema: {
          type: "string",
          example: "att-c1f4de57-54e5-44a9-9ae3-8c5d8e2d7ff7",
        },
      },
      InviteIdPath: {
        name: "inviteId",
        in: "path",
        required: true,
        description: "Organization invite document id.",
        schema: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
        },
      },
      UploadFileIdPath: {
        name: "fileId",
        in: "path",
        required: true,
        description: "GridFS file id returned by `POST /api/uploads`.",
        schema: {
          type: "string",
          example: "507f1f77bcf86cd799439012",
        },
      },
      RecordingIdPath: {
        name: "recordingId",
        in: "path",
        required: true,
        description: "Transcription recording id returned by `POST /api/transcriptions/recordings`.",
        schema: {
          type: "string",
          example: "507f1f77bcf86cd799439013",
        },
      },
      WebhookPathTokenPath: {
        name: "webhookPathToken",
        in: "path",
        required: true,
        description:
          "Secret path token from the `webhookUrl` returned by `POST /api/organizations/github/webhook-setup`.",
        schema: {
          type: "string",
          example: "3f9a1c0b8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7c6b5",
        },
      },
      GithubCodeQuery: {
        name: "code",
        in: "query",
        required: true,
        description: "OAuth authorization code returned by GitHub.",
        schema: {
          type: "string",
          example: "1234567890abcdef",
        },
      },
      GithubStateQuery: {
        name: "state",
        in: "query",
        required: true,
        description: "Signed OAuth state returned by GitHub.",
        schema: {
          type: "string",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        },
      },
      StatusFilterQuery: {
        name: "status",
        in: "query",
        required: false,
        description:
          "Comma-separated status slugs to include (e.g. `todo,in-progress`). `inprogress`, `in_progress` and `cancelled` are normalised; invalid tokens are ignored.",
        schema: { type: "string", example: "todo,in-progress" },
      },
      PriorityFilterQuery: {
        name: "priority",
        in: "query",
        required: false,
        description:
          "Comma-separated priorities (`low`, `medium`, `high`, `urgent`, `none` / `no-priority`).",
        schema: { type: "string", example: "high,urgent" },
      },
      LabelFilterQuery: {
        name: "label",
        in: "query",
        required: false,
        description: `Comma-separated labels (${ISSUE_LABEL.join(", ")}). Unknown labels are ignored.`,
        schema: { type: "string", example: "Bug,Feature" },
      },
      AssigneeFilterQuery: {
        name: "assignee",
        in: "query",
        required: false,
        description:
          "Comma-separated assignee filters: user ids, `me`, and/or `unassigned`.",
        schema: { type: "string", example: "me,unassigned" },
      },
    },
    responses: {
      BadRequest: {
        description:
          "Bad request (validation error, or missing/invalid `X-Organization-Id` on organization-scoped routes)",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            examples: {
              invalidInput: failureExample("Invalid input"),
              organizationRequired: failureExample("Organization required"),
              tooLong: failureExample("Title is too long (max 500 characters)"),
            },
          },
        },
      },
      Unauthorized: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: { success: false, data: null, error: "Unauthorized" },
          },
        },
      },
      Forbidden: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: { success: false, data: null, error: "Forbidden" },
          },
        },
      },
      OriginNotAllowed: {
        description:
          "State-changing request sent with an `Origin` header that is not an allowed frontend origin.",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: { success: false, data: null, error: "Request origin not allowed" },
          },
        },
      },
      ForbiddenOrOriginNotAllowed: {
        description:
          "Forbidden: not a workspace member or insufficient role, or the request's `Origin` header is not allowed (`Request origin not allowed`).",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            examples: {
              forbidden: failureExample("Forbidden"),
              originNotAllowed: failureExample("Request origin not allowed"),
            },
          },
        },
      },
      NotFound: {
        description: "Not found",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: { success: false, data: null, error: "Not found" },
          },
        },
      },
      Conflict: {
        description: "Conflict",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: {
              success: false,
              data: null,
              error: "Email already registered",
            },
          },
        },
      },
      TooManyRequests: {
        description: "Rate limited. Retry after the number of seconds in `Retry-After`.",
        headers: {
          "Retry-After": { $ref: "#/components/headers/RetryAfter" },
        },
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: {
              success: false,
              data: null,
              error: "Too many requests. Try again later.",
            },
          },
        },
      },
      BadGateway: {
        description: "Upstream dependency failed",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: {
              success: false,
              data: null,
              error: "Could not send invitation email",
            },
          },
        },
      },
      ServiceUnavailable: {
        description: "Service unavailable",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: {
              success: false,
              data: null,
              error: "GitHub integration is not configured",
            },
          },
        },
      },
      InternalServerError: {
        description: "Unexpected server error",
        content: {
          "application/json": {
            schema: schemaRef("ApiFailure"),
            example: {
              success: false,
              data: null,
              error: "Something went wrong",
            },
          },
        },
      },
    },
    schemas: {
      ApiFailure: {
        type: "object",
        required: ["success", "data", "error"],
        properties: {
          success: { type: "boolean", enum: [false] },
          data: { nullable: true, example: null },
          error: { type: "string", example: "Unauthorized" },
        },
      },
      OrganizationRole: {
        type: "string",
        enum: [...ORGANIZATION_ROLE],
      },
      InviteRole: {
        type: "string",
        enum: [...INVITE_ROLE],
      },
      InviteStatus: {
        type: "string",
        enum: [...INVITE_STATUS],
      },
      IssueStatus: {
        type: "string",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        maxLength: 64,
        description: `Lowercase kebab-case status slug. Not a fixed enum: it must match the \`status\` of a column on some board (the issue's project board, the workspace issues board, or any project board in the workspace), otherwise 400 \`Status is not a column on this board\`. Every board contains the core statuses ${CORE_ISSUE_STATUS.map((s) => `\`${s}\``).join(", ")}.`,
        example: "in-progress",
      },
      IssuePriority: {
        type: "string",
        enum: [...ISSUE_PRIORITY],
      },
      IssueLabel: {
        type: "string",
        enum: [...ISSUE_LABEL],
      },
      DeletedResult: {
        type: "object",
        required: ["deleted"],
        properties: {
          deleted: { type: "boolean", enum: [true] },
        },
      },
      BoardColumn: {
        type: "object",
        required: ["id", "title", "status"],
        properties: {
          id: { type: "string", maxLength: 128, example: "col-in-progress" },
          title: { type: "string", maxLength: 120, example: "In Progress" },
          status: schemaRef("IssueStatus"),
        },
      },
      BoardColumnsInput: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        description:
          "Board columns. Status slugs must be unique and the core statuses `backlog`, `todo`, `in-progress` and `done` must all be present.",
        items: schemaRef("BoardColumn"),
      },
      IssuesBoardColumnsResult: {
        type: "object",
        required: ["columns"],
        properties: {
          columns: arrayOf("BoardColumn"),
        },
      },
      OrganizationSummary: {
        type: "object",
        required: ["id", "name", "role"],
        properties: {
          id: { type: "string", example: "507f191e810c19729de860ea" },
          name: { type: "string", example: "Demo Workspace" },
          role: schemaRef("OrganizationRole"),
        },
      },
      AuthMePayload: {
        type: "object",
        required: [
          "id",
          "email",
          "name",
          "initials",
          "organizations",
          "currentOrganizationId",
        ],
        properties: {
          id: { type: "string", example: "507f191e810c19729de860eb" },
          email: { type: "string", format: "email", example: "demo@track.io" },
          name: { type: "string", example: "Demo User" },
          initials: { type: "string", example: "DU" },
          organizations: arrayOf("OrganizationSummary"),
          currentOrganizationId: {
            type: "string",
            nullable: true,
            example: "507f191e810c19729de860ea",
          },
        },
      },
      InvitePreview: {
        type: "object",
        required: ["organizationName", "role"],
        properties: {
          organizationName: { type: "string", example: "Demo Workspace" },
          role: schemaRef("InviteRole"),
        },
      },
      SimpleMessage: {
        type: "object",
        required: ["message"],
        properties: {
          message: {
            type: "string",
            example:
              "If an account exists for that email, we sent password reset instructions.",
          },
        },
      },
      AcceptInviteResult: {
        type: "object",
        required: ["organizationId"],
        properties: {
          organizationId: {
            type: "string",
            example: "507f191e810c19729de860ea",
          },
        },
      },
      PatchOrganizationResult: {
        type: "object",
        description:
          "Contains `id` and `name` when the name was changed, `columns` when `issuesBoardColumns` was sent, or all three when both were updated.",
        properties: {
          id: { type: "string", example: "507f191e810c19729de860ea" },
          name: { type: "string", example: "Product Engineering" },
          columns: arrayOf("BoardColumn"),
        },
      },
      GithubWebhookSetupResult: {
        type: "object",
        required: ["webhookUrl", "secret"],
        properties: {
          webhookUrl: {
            type: "string",
            format: "uri",
            example:
              "https://api.track.io/api/integrations/github/webhook/3f9a1c0b8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7c6b5",
          },
          secret: {
            type: "string",
            description:
              "HMAC secret to configure on the GitHub webhook. Regenerated (and the previous URL/secret invalidated) on every call.",
            example: "9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
          },
        },
      },
      ProjectCard: {
        type: "object",
        required: ["slug", "name", "status", "members", "progress", "color", "githubRepoFullName"],
        properties: {
          slug: { type: "string", example: "linear-architect" },
          name: { type: "string", example: "Linear Architect" },
          status: { type: "string", example: "Active" },
          members: { type: "integer", example: 5 },
          progress: { type: "integer", example: 65 },
          color: { type: "string", example: "bg-indigo-500" },
          githubRepoFullName: {
            type: "string",
            description: "Linked GitHub repository `owner/repo` (lowercase), empty string when unset.",
            example: "acme/linear-architect",
          },
        },
      },
      ProjectMember: {
        type: "object",
        required: ["id", "name", "initials"],
        properties: {
          id: { type: "string", example: "507f191e810c19729de860eb" },
          name: { type: "string", example: "John Doe" },
          initials: { type: "string", example: "JD" },
        },
      },
      ProjectDetail: {
        type: "object",
        required: [
          "id",
          "slug",
          "name",
          "keyPrefix",
          "githubRepoFullName",
          "memberCount",
          "issueCount",
          "members",
          "boardColumns",
        ],
        properties: {
          id: { type: "string", example: "507f191e810c19729de860ec" },
          slug: { type: "string", example: "linear-architect" },
          name: { type: "string", example: "Linear Architect" },
          keyPrefix: { type: "string", example: "LA" },
          githubRepoFullName: {
            type: "string",
            description: "Linked GitHub repository `owner/repo` (lowercase), empty string when unset.",
            example: "acme/linear-architect",
          },
          memberCount: { type: "integer", example: 5 },
          issueCount: { type: "integer", example: 12 },
          members: arrayOf("ProjectMember"),
          boardColumns: arrayOf("BoardColumn"),
        },
      },
      IssueAttachment: {
        type: "object",
        required: ["id", "filename", "size", "mimeType", "url"],
        properties: {
          id: {
            type: "string",
            example: "att-c1f4de57-54e5-44a9-9ae3-8c5d8e2d7ff7",
          },
          filename: { type: "string", example: "specifications.pdf" },
          size: { type: "integer", example: 2516582 },
          mimeType: { type: "string", example: "application/pdf" },
          url: {
            type: "string",
            description:
              "Download URL served by this API (`/api/uploads/files/{fileId}`, relative or absolute on the API origin).",
            example: "/api/uploads/files/507f1f77bcf86cd799439012",
          },
        },
      },
      IssueComment: {
        type: "object",
        required: [
          "id",
          "authorUserId",
          "authorName",
          "authorInitials",
          "avatarSeed",
          "timeLabel",
          "body",
          "attachments",
        ],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439012" },
          authorUserId: { type: "string", example: "507f191e810c19729de860eb" },
          authorName: { type: "string", example: "John Doe" },
          authorInitials: { type: "string", example: "JD" },
          avatarSeed: { type: "string", example: "John Doe" },
          timeLabel: { type: "string", example: "2h ago" },
          body: {
            type: "string",
            example:
              "Started layout scaffolding; grid approach looks right for v1.",
          },
          attachments: arrayOf("IssueAttachment"),
        },
      },
      IssueSubtask: {
        type: "object",
        required: ["id", "title", "done"],
        properties: {
          id: { type: "string", example: "st-1" },
          title: { type: "string", example: "Wire up the grid component" },
          done: { type: "boolean", example: false },
          linkedIssueId: { type: "string", nullable: true, example: "LA-1022" },
          linkedAssigneeInitials: { type: "string", nullable: true, example: "JD" },
          linkedDueDate: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: "2026-04-20T12:00:00.000Z",
          },
        },
      },
      GithubLink: {
        type: "object",
        required: [
          "id",
          "kind",
          "owner",
          "repo",
          "pullNumber",
          "headRef",
          "htmlUrl",
          "title",
          "state",
          "merged",
          "source",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439099" },
          kind: { type: "string", enum: ["pull_request", "branch"] },
          owner: { type: "string", example: "acme" },
          repo: { type: "string", example: "linear-architect" },
          pullNumber: { type: "integer", nullable: true, example: 42 },
          headRef: { type: "string", example: "feature/LA-1021-bento-grid" },
          htmlUrl: { type: "string", format: "uri", example: "https://github.com/acme/linear-architect/pull/42" },
          title: { type: "string", example: "LA-1021 Bento grid layout" },
          state: { type: "string", example: "open" },
          merged: { type: "boolean", example: false },
          source: { type: "string", enum: ["webhook", "manual"] },
          updatedAt: { type: "string", format: "date-time", example: "2026-04-17T12:00:00.000Z" },
        },
      },
      IssueList: {
        type: "object",
        required: [
          "id",
          "key",
          "title",
          "status",
          "priority",
          "label",
          "assignee",
          "assigneeName",
          "date",
          "sortOrder",
        ],
        properties: {
          id: { type: "string", example: "LA-1021" },
          key: { type: "string", example: "LA-1021" },
          title: {
            type: "string",
            example: "Implement dynamic bento grid layout for user dashboards",
          },
          status: schemaRef("IssueStatus"),
          priority: schemaRef("IssuePriority"),
          label: schemaRef("IssueLabel"),
          assignee: {
            type: "string",
            description: "Assignee initials, or `—` when unassigned.",
            example: "JD",
          },
          assigneeName: {
            type: "string",
            nullable: true,
            example: "John Doe",
          },
          date: { type: "string", example: "2d ago" },
          sortOrder: { type: "integer", example: 0 },
          projectId: {
            type: "string",
            description: "Despite the name, this holds the project **slug**, not its database id.",
            example: "linear-architect",
          },
          githubLinkCount: {
            type: "integer",
            description: "Number of linked GitHub pull requests/branches.",
            example: 1,
          },
        },
      },
      IssueDetail: {
        allOf: [
          schemaRef("IssueList"),
          {
            type: "object",
            required: [
              "description",
              "unread",
              "comments",
              "attachments",
              "subtasks",
              "githubLinks",
              "projectSlug",
              "projectName",
              "assigneeId",
              "assigneeInitials",
              "dueDate",
              "createdAt",
              "updatedAt",
            ],
            properties: {
              description: {
                type: "string",
                example: "<p>Build a responsive bento grid for dashboards.</p>",
              },
              unread: { type: "boolean", example: false },
              comments: arrayOf("IssueComment"),
              attachments: arrayOf("IssueAttachment"),
              subtasks: arrayOf("IssueSubtask"),
              githubLinks: arrayOf("GithubLink"),
              projectSlug: { type: "string", example: "linear-architect" },
              projectName: { type: "string", example: "Linear Architect" },
              assigneeId: {
                type: "string",
                nullable: true,
                example: "507f191e810c19729de860eb",
              },
              assigneeInitials: {
                type: "string",
                nullable: true,
                example: "JD",
              },
              dueDate: {
                type: "string",
                format: "date-time",
                nullable: true,
                example: "2026-04-20T12:00:00.000Z",
              },
              createdAt: {
                type: "string",
                format: "date-time",
                example: "2026-04-17T10:00:00.000Z",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
                example: "2026-04-17T12:00:00.000Z",
              },
            },
          },
        ],
      },
      OrganizationMember: {
        type: "object",
        required: ["userId", "name", "email", "initials", "role"],
        properties: {
          userId: { type: "string", example: "507f191e810c19729de860eb" },
          name: { type: "string", example: "John Doe" },
          email: { type: "string", format: "email", example: "john@track.io" },
          initials: { type: "string", example: "JD" },
          role: schemaRef("OrganizationRole"),
        },
      },
      OrganizationInviteRow: {
        type: "object",
        required: [
          "id",
          "email",
          "role",
          "status",
          "invitedByUserId",
          "invitedByName",
          "expiresAt",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439011" },
          email: {
            type: "string",
            format: "email",
            example: "new.user@track.io",
          },
          role: schemaRef("InviteRole"),
          status: schemaRef("InviteStatus"),
          invitedByUserId: {
            type: "string",
            example: "507f191e810c19729de860eb",
          },
          invitedByName: { type: "string", example: "Demo User" },
          expiresAt: {
            type: "string",
            format: "date-time",
            example: "2026-04-24T12:00:00.000Z",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-04-17T12:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-04-17T12:05:00.000Z",
          },
        },
      },
      GithubStatus: {
        type: "object",
        required: ["connected", "githubLogin"],
        properties: {
          connected: { type: "boolean", example: true },
          githubLogin: { type: "string", nullable: true, example: "octocat" },
        },
      },
      GithubOauthUrlResult: {
        type: "object",
        required: ["url"],
        properties: {
          url: {
            type: "string",
            format: "uri",
            example: "https://github.com/login/oauth/authorize?client_id=...",
          },
        },
      },
      GithubWebhookResult: {
        type: "object",
        required: ["ok"],
        properties: {
          ok: { type: "boolean", example: true },
          error: { type: "string", example: "Invalid signature" },
        },
      },
      ActiveSprint: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439021" },
          name: { type: "string", example: "Sprint 14" },
        },
      },
      UploadResult: {
        type: "object",
        required: ["url", "filename", "size", "mimeType"],
        properties: {
          url: {
            type: "string",
            description: "Relative download path on this API.",
            example: "/api/uploads/files/507f1f77bcf86cd799439012",
          },
          filename: { type: "string", example: "specifications.pdf" },
          size: { type: "integer", example: 2516582 },
          mimeType: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
            example: "application/pdf",
          },
        },
      },
      TranscriptCandidate: {
        type: "object",
        required: ["clientId", "title", "description", "priority", "dueDate", "confidence"],
        properties: {
          clientId: { type: "string", example: "cand-1" },
          title: { type: "string", example: "Send revised pricing deck to Acme" },
          description: { type: "string", example: "Mentioned by Sam near the end of the call." },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          dueDate: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: "2026-04-24T00:00:00.000Z",
          },
          confidence: { type: "number", minimum: 0, maximum: 1, example: 0.82 },
        },
      },
      TranscriptExtractResult: {
        type: "object",
        required: ["candidates"],
        properties: {
          candidates: arrayOf("TranscriptCandidate"),
        },
      },
      CreateIssuesFromTranscriptRequest: {
        type: "object",
        required: ["projectSlug", "items"],
        properties: {
          projectSlug: { type: "string", example: "linear-architect" },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: {
              type: "object",
              required: ["title"],
              properties: {
                title: { type: "string", example: "Send revised pricing deck to Acme" },
                description: { type: "string" },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high", "urgent"],
                  default: "medium",
                },
                dueDate: { type: "string", format: "date-time", nullable: true },
                assigneeId: {
                  type: "string",
                  nullable: true,
                  description: "Omit to default to the current user; null/empty for unassigned.",
                },
              },
            },
          },
        },
      },
      CreateIssuesFromTranscriptResult: {
        type: "object",
        required: ["created", "skipped"],
        description:
          "Issues are created with status `todo`. Items failing validation are reported in `skipped` instead of failing the whole request.",
        properties: {
          created: arrayOf("IssueList"),
          skipped: {
            type: "array",
            items: {
              type: "object",
              required: ["reason", "item"],
              properties: {
                reason: { type: "string", example: "Invalid title" },
                item: {
                  type: "object",
                  required: ["title"],
                  properties: { title: { type: "string", example: "" } },
                },
              },
            },
          },
        },
      },
      RecordingStatus: {
        type: "string",
        enum: [...RECORDING_STATUS],
      },
      RecordingCreated: {
        type: "object",
        required: ["id", "status", "filename", "size", "mimeType"],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439013" },
          status: schemaRef("RecordingStatus"),
          filename: { type: "string", example: "standup.webm" },
          size: { type: "integer", example: 482113 },
          mimeType: { type: "string", example: "audio/webm" },
        },
      },
      Recording: {
        type: "object",
        required: [
          "id",
          "status",
          "filename",
          "mimeType",
          "size",
          "durationMs",
          "transcriptText",
          "errorMessage",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439013" },
          status: schemaRef("RecordingStatus"),
          filename: { type: "string", example: "standup.webm" },
          mimeType: { type: "string", example: "audio/webm" },
          size: { type: "integer", example: 482113 },
          durationMs: { type: "number", nullable: true, example: 61234 },
          transcriptText: { type: "string", example: "" },
          errorMessage: { type: "string", example: "" },
          createdAt: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      RecordingTranscribeResult: {
        type: "object",
        required: ["id", "status", "transcriptText"],
        properties: {
          id: { type: "string", example: "507f1f77bcf86cd799439013" },
          status: schemaRef("RecordingStatus"),
          transcriptText: { type: "string", example: "Okay, so the first item is the pricing deck..." },
        },
      },
      RecordingCandidatesResult: {
        type: "object",
        required: ["recordingId", "status", "candidates"],
        properties: {
          recordingId: { type: "string", example: "507f1f77bcf86cd799439013" },
          status: schemaRef("RecordingStatus"),
          candidates: arrayOf("TranscriptCandidate"),
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "demo@track.io" },
          password: { type: "string", example: "password123" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", maxLength: 100, example: "Demo User" },
          email: { type: "string", format: "email", maxLength: 254, example: "demo@track.io" },
          password: { type: "string", minLength: 8, maxLength: 200, example: "password123" },
        },
      },
      PatchProfileRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, example: "Demo User" },
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "demo@track.io" },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["token", "password"],
        properties: {
          token: { type: "string", example: "reset_token_here" },
          password: { type: "string", minLength: 8, example: "new-password-123" },
        },
      },
      TokenRequest: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", example: "invite_token_here" },
        },
      },
      RenameOrganizationRequest: {
        type: "object",
        description:
          "Send `name` and/or `issuesBoardColumns`; at least one must be valid or the request fails with 400 `No valid fields`. Owners and admins only.",
        properties: {
          name: {
            type: "string",
            maxLength: 100,
            example: "Product Engineering",
            description: "New workspace name (ignored when empty/whitespace).",
          },
          issuesBoardColumns: {
            allOf: [schemaRef("BoardColumnsInput")],
            nullable: true,
            description:
              "Workspace-wide issues board columns. `null` clears the override so the board falls back to the union of project boards.",
          },
        },
      },
      CreateInviteRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            maxLength: 254,
            example: "new.user@track.io",
          },
          role: { allOf: [schemaRef("InviteRole")], default: "member" },
        },
      },
      CreateProjectRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 100, example: "Customer Portal" },
        },
      },
      PatchProjectRequest: {
        type: "object",
        description:
          "Send `boardColumns` and/or `githubRepoFullName` (at least one, otherwise 400 `No valid fields`). Owners and admins only.",
        properties: {
          boardColumns: schemaRef("BoardColumnsInput"),
          githubRepoFullName: {
            type: "string",
            nullable: true,
            description:
              "`owner/repo` or a GitHub repository URL. Empty string or null unlinks the repository.",
            example: "acme/linear-architect",
          },
        },
      },
      CreateIssueRequest: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", maxLength: 500, example: "Implement OAuth callback screen" },
          description: {
            type: "string",
            maxLength: 100000,
            example: "Build the callback state-handling UI.",
          },
          status: schemaRef("IssueStatus"),
          priority: { allOf: [schemaRef("IssuePriority")], default: "medium" },
          label: { allOf: [schemaRef("IssueLabel")], default: "General" },
          projectSlug: {
            type: "string",
            nullable: true,
            example: "linear-architect",
            description:
              "Only used by `POST /api/issues`. Project-scoped creation takes slug from the path.",
          },
          assigneeId: {
            type: "string",
            nullable: true,
            example: "507f191e810c19729de860eb",
            description:
              "Omit to default to the current user. Set null to create an unassigned issue.",
          },
          dueDate: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Optional due date (ISO string).",
          },
        },
      },
      PatchIssueRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 500, example: "Implement OAuth callback page" },
          description: {
            type: "string",
            maxLength: 100000,
            example: "<p>Updated HTML description.</p>",
          },
          status: schemaRef("IssueStatus"),
          priority: schemaRef("IssuePriority"),
          label: {
            allOf: [schemaRef("IssueLabel")],
            nullable: true,
            description: "Null or empty string resets to `General`.",
          },
          unread: { type: "boolean", example: false },
          sortOrder: { type: "integer", example: 1 },
          assigneeId: {
            type: "string",
            nullable: true,
            example: "507f191e810c19729de860eb",
          },
          dueDate: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: "2026-04-20T12:00:00.000Z",
          },
          subtasks: {
            type: "array",
            description: "Replace the full checklist (max 100 items, titles ≤ 500 characters).",
            maxItems: 100,
            items: {
              type: "object",
              required: ["id", "title", "done"],
              properties: {
                id: { type: "string" },
                title: { type: "string", maxLength: 500 },
                done: { type: "boolean" },
                linkedIssueId: {
                  type: "string",
                  nullable: true,
                  description:
                    "Optional issue key (same as `displayId`, e.g. LA-12). When set, the subtask links to that issue.",
                },
              },
            },
          },
        },
      },
      AddCommentRequest: {
        type: "object",
        properties: {
          body: {
            type: "string",
            maxLength: 10000,
            example:
              "Started layout scaffolding; grid approach looks right for v1.",
          },
          attachments: {
            type: "array",
            maxItems: 8,
            items: schemaRef("IssueAttachment"),
          },
        },
      },
      PatchCommentRequest: {
        type: "object",
        required: ["body"],
        properties: {
          body: { type: "string", minLength: 1, maxLength: 10000, example: "Updated comment text." },
        },
      },
      AddAttachmentRequest: {
        type: "object",
        required: ["filename", "size", "mimeType", "url"],
        properties: {
          filename: { type: "string", example: "specifications.pdf" },
          size: { type: "integer", example: 2516582 },
          mimeType: { type: "string", example: "application/pdf" },
          url: {
            type: "string",
            description:
              "Must be a `/api/uploads/files/{fileId}` URL on this API whose file belongs to the workspace.",
            example: "/api/uploads/files/507f1f77bcf86cd799439012",
          },
        },
      },
    },
  },
  paths: {
    "/api/auth/invite-preview": {
      get: {
        tags: ["Auth"],
        summary: "Preview an invitation",
        description:
          "Returns workspace name and role for an invite token without revealing whether an email exists. Rate limited (40/min per IP).",
        parameters: [parameterRef("TokenQuery")],
        responses: {
          "200": successResponse(
            "Invitation preview",
            schemaRef("InvitePreview"),
          ),
          "404": responseRef("NotFound"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset",
        description:
          "Sends a reset link if the account exists. Response is intentionally generic. Rate limited (8/min per IP and 5 per 15 minutes per email).",
        requestBody: jsonRequestBody(schemaRef("ForgotPasswordRequest")),
        responses: {
          "200": successResponse(
            "Generic password reset message",
            schemaRef("SimpleMessage"),
          ),
          "403": responseRef("OriginNotAllowed"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with token",
        description:
          "Sets a new password (min 8 characters) and revokes all existing sessions. Rate limited (15/min per IP).",
        requestBody: jsonRequestBody(schemaRef("ResetPasswordRequest")),
        responses: {
          "200": successResponse("Password updated", {
            type: "boolean",
            enum: [true],
          }),
          "400": responseRef("BadRequest"),
          "403": responseRef("OriginNotAllowed"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/accept-invite": {
      post: {
        tags: ["Auth"],
        summary: "Accept a workspace invitation",
        description: "Must be signed in with the invited email. Rate limited (25/min per IP).",
        security: cookieSecurity,
        requestBody: jsonRequestBody(schemaRef("TokenRequest")),
        responses: {
          "200": successResponse(
            "Invitation accepted",
            schemaRef("AcceptInviteResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/decline-invite": {
      post: {
        tags: ["Auth"],
        summary: "Decline a workspace invitation",
        description: "Must be signed in with the invited email. Rate limited (25/min per IP).",
        security: cookieSecurity,
        requestBody: jsonRequestBody(schemaRef("TokenRequest")),
        responses: {
          "200": successResponse("Invitation declined", {
            type: "boolean",
            enum: [true],
          }),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current session user",
        security: cookieSecurity,
        parameters: [optionalPreferredOrgHeader],
        responses: {
          "200": successResponse(
            "Current user and organizations",
            schemaRef("AuthMePayload"),
          ),
          "401": responseRef("Unauthorized"),
          "500": responseRef("InternalServerError"),
        },
      },
      patch: {
        tags: ["Auth"],
        summary: "Update current user profile",
        security: cookieSecurity,
        parameters: [optionalPreferredOrgHeader],
        requestBody: jsonRequestBody(schemaRef("PatchProfileRequest")),
        responses: {
          "200": successResponse(
            "Updated current user profile",
            schemaRef("AuthMePayload"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("OriginNotAllowed"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description:
          "Creates a session and sets the `trackio_token` httpOnly cookie. Rate limited (40/min per IP, plus 10 failed attempts per 15 minutes per email; a successful login resets the per-email counter).",
        requestBody: jsonRequestBody(schemaRef("LoginRequest")),
        responses: {
          "200": successResponse(
            "Authenticated user",
            schemaRef("AuthMePayload"),
          ),
          "401": responseRef("Unauthorized"),
          "403": responseRef("OriginNotAllowed"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register",
        description:
          "Creates a new user, a starter workspace, and sets the `trackio_token` httpOnly cookie. Name ≤ 100 characters, valid email, password 8–200 characters. Rate limited (20/min per IP).",
        requestBody: jsonRequestBody(schemaRef("RegisterRequest")),
        responses: {
          "200": successResponse("Registered user", schemaRef("AuthMePayload")),
          "400": responseRef("BadRequest"),
          "403": responseRef("OriginNotAllowed"),
          "409": responseRef("Conflict"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description:
          "Clears the session cookie. Does not require a valid session; when the cookie is valid, every session of the user is revoked (all devices).",
        security: [],
        responses: {
          "200": successResponse("Logged out", {
            type: "boolean",
            enum: [true],
          }),
          "403": responseRef("OriginNotAllowed"),
        },
      },
    },
    "/api/organizations/issues-board-columns": {
      get: {
        tags: ["Organizations"],
        summary: "Get the workspace issues board columns",
        description:
          "Returns the stored workspace override, or (when none) the union of the columns of the caller's project boards.",
        security: organizationSecurity,
        responses: {
          "200": successResponse(
            "Issues board columns",
            schemaRef("IssuesBoardColumnsResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/invites": {
      post: {
        tags: ["Organizations"],
        summary: "Invite a workspace member",
        description: "Owners and admins only. Rate limited (20/min per IP).",
        security: organizationSecurity,
        requestBody: jsonRequestBody(schemaRef("CreateInviteRequest")),
        responses: {
          "200": successResponse("Invitation queued", {
            type: "object",
            required: ["email"],
            properties: {
              email: {
                type: "string",
                format: "email",
                example: "new.user@track.io",
              },
            },
          }),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "409": responseRef("Conflict"),
          "429": responseRef("TooManyRequests"),
          "502": responseRef("BadGateway"),
          "500": responseRef("InternalServerError"),
        },
      },
      get: {
        tags: ["Organizations"],
        summary: "List workspace invites",
        description: "Owners and admins only.",
        security: organizationSecurity,
        responses: {
          "200": successResponse(
            "Workspace invites",
            arrayOf("OrganizationInviteRow"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/invites/{inviteId}": {
      delete: {
        tags: ["Organizations"],
        summary: "Cancel a pending invite",
        description: "Owners and admins only. Rate limited (30/min per IP).",
        security: organizationSecurity,
        parameters: [parameterRef("InviteIdPath")],
        responses: {
          "200": successResponse("Invite cancelled", {
            type: "boolean",
            enum: [true],
          }),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "429": responseRef("TooManyRequests"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/members": {
      get: {
        tags: ["Organizations"],
        summary: "List workspace members",
        security: organizationSecurity,
        responses: {
          "200": successResponse(
            "Workspace members",
            arrayOf("OrganizationMember"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations": {
      patch: {
        tags: ["Organizations"],
        summary: "Update workspace settings",
        description:
          "Renames the workspace and/or replaces (or clears) the workspace issues board columns. Owners and admins only.",
        security: organizationSecurity,
        requestBody: jsonRequestBody(schemaRef("RenameOrganizationRequest")),
        responses: {
          "200": successResponse(
            "Updated workspace",
            schemaRef("PatchOrganizationResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/github/status": {
      get: {
        tags: ["Integrations"],
        summary: "Get GitHub connection status",
        security: organizationSecurity,
        responses: {
          "200": successResponse(
            "GitHub connection status",
            schemaRef("GithubStatus"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/github/oauth-url": {
      get: {
        tags: ["Integrations"],
        summary: "Get GitHub OAuth URL",
        description: "Owners and admins only.",
        security: organizationSecurity,
        responses: {
          "200": successResponse(
            "GitHub OAuth URL",
            schemaRef("GithubOauthUrlResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "503": responseRef("ServiceUnavailable"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/github": {
      delete: {
        tags: ["Integrations"],
        summary: "Disconnect GitHub from the workspace",
        security: organizationSecurity,
        responses: {
          "200": successResponse("GitHub disconnected", {
            type: "boolean",
            enum: [true],
          }),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/organizations/github/webhook-setup": {
      post: {
        tags: ["Integrations"],
        summary: "Generate GitHub webhook URL and secret",
        description:
          "Owners and admins only. Generates a new webhook path token and HMAC secret for the workspace (invalidating any previous ones) and returns the URL to configure on GitHub.",
        security: organizationSecurity,
        responses: {
          "200": successResponse(
            "Webhook credentials",
            schemaRef("GithubWebhookSetupResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/integrations/github/callback": {
      get: {
        tags: ["Integrations"],
        summary: "Handle GitHub OAuth callback",
        description:
          "Consumes `code` and `state`, stores the workspace token, and redirects to the frontend integrations page.",
        security: cookieSecurity,
        parameters: [
          parameterRef("GithubCodeQuery"),
          parameterRef("GithubStateQuery"),
        ],
        responses: {
          "302": {
            description:
              "Redirects to the frontend `/integrations` page with `?github=connected` or `?github=error`.",
          },
          "401": responseRef("Unauthorized"),
        },
      },
    },
    "/api/integrations/github/webhook/{webhookPathToken}": {
      post: {
        tags: ["Integrations"],
        summary: "Receive GitHub webhook events",
        description:
          "Called by GitHub, not by the app. The raw `application/json` body (up to 5 MB) is verified against the workspace secret via `X-Hub-Signature-256`. Handles `ping`, `pull_request` and `push` events to link PRs/branches to issues; other events are acknowledged and ignored. Responses use `{ ok, error? }` instead of the standard envelope. No cookie or Origin check applies.",
        security: [],
        parameters: [
          parameterRef("WebhookPathTokenPath"),
          {
            name: "X-Hub-Signature-256",
            in: "header",
            required: true,
            description: "`sha256=` HMAC of the raw body using the webhook secret.",
            schema: { type: "string", example: "sha256=5d7e..." },
          },
          {
            name: "X-GitHub-Event",
            in: "header",
            required: false,
            description: "GitHub event name (`ping`, `pull_request`, `push`, ...).",
            schema: { type: "string", example: "pull_request" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
                description: "GitHub webhook payload (passed through as raw bytes for signature verification).",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Event accepted (or ignored)",
            content: {
              "application/json": {
                schema: schemaRef("GithubWebhookResult"),
                example: { ok: true },
              },
            },
          },
          "400": {
            description: "Body is not valid JSON",
            content: {
              "application/json": {
                schema: schemaRef("GithubWebhookResult"),
                example: { ok: false, error: "Invalid JSON" },
              },
            },
          },
          "401": {
            description: "Missing or invalid signature",
            content: {
              "application/json": {
                schema: schemaRef("GithubWebhookResult"),
                example: { ok: false, error: "Invalid signature" },
              },
            },
          },
          "404": {
            description: "Unknown webhook token or webhook not configured",
            content: {
              "application/json": {
                schema: schemaRef("GithubWebhookResult"),
                example: { ok: false, error: "Not found" },
              },
            },
          },
          "415": {
            description: "Content type is not `application/json`",
            content: {
              "application/json": {
                schema: schemaRef("GithubWebhookResult"),
                example: { ok: false, error: "Webhook content type must be application/json" },
              },
            },
          },
          "500": {
            description: "Unexpected server error",
            content: {
              "application/json": {
                schema: schemaRef("GithubWebhookResult"),
                example: { ok: false, error: "Something went wrong" },
              },
            },
          },
        },
      },
    },
    "/api/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects for the current workspace membership",
        security: organizationSecurity,
        responses: {
          "200": successResponse("Projects", arrayOf("ProjectCard")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalServerError"),
        },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project",
        description:
          "Creates the project (name ≤ 100 characters) and, unless disabled by env, seeds three starter issues into it.",
        security: organizationSecurity,
        requestBody: jsonRequestBody(schemaRef("CreateProjectRequest")),
        responses: {
          "200": successResponse("Created project", schemaRef("ProjectCard")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "409": responseRef("Conflict"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/projects/{slug}": {
      get: {
        tags: ["Projects"],
        summary: "Get project detail",
        security: organizationSecurity,
        parameters: [parameterRef("SlugPath")],
        responses: {
          "200": successResponse("Project detail", schemaRef("ProjectDetail")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update project settings",
        description:
          "Replaces the project board columns and/or links/unlinks a GitHub repository. Owners and admins only; the caller must be a project member.",
        security: organizationSecurity,
        parameters: [parameterRef("SlugPath")],
        requestBody: jsonRequestBody(schemaRef("PatchProjectRequest")),
        responses: {
          "200": successResponse("Updated project detail", schemaRef("ProjectDetail")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/projects/{slug}/issues": {
      get: {
        tags: ["Projects"],
        summary: "List issues for a project",
        security: organizationSecurity,
        parameters: [parameterRef("SlugPath"), ...issueListFilterParameters],
        responses: {
          "200": successResponse("Project issues", arrayOf("IssueList")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
      post: {
        tags: ["Projects"],
        summary: "Create an issue in a project",
        security: organizationSecurity,
        parameters: [parameterRef("SlugPath")],
        requestBody: jsonRequestBody(schemaRef("CreateIssueRequest")),
        responses: {
          "200": successResponse(
            "Created project issue",
            schemaRef("IssueList"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/projects/{slug}/issues/{issueId}": {
      patch: {
        tags: ["Projects"],
        summary: "Patch a project-scoped issue",
        security: organizationSecurity,
        parameters: [parameterRef("SlugPath"), parameterRef("IssueIdPath")],
        requestBody: jsonRequestBody(schemaRef("PatchIssueRequest")),
        responses: {
          "200": successResponse(
            "Updated project issue",
            schemaRef("IssueList"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/issues": {
      get: {
        tags: ["Issues"],
        summary: "List all visible issues across projects",
        description:
          "Returns issues from projects the caller belongs to, one page at a time (most recently updated first, then each page ordered for the board). Page size is `limit` (default and max 1000). The body stays a plain array; paging is signalled via headers: when `X-Results-Truncated` is `true`, request the next page with `offset` set to `X-Next-Offset`.",
        security: organizationSecurity,
        parameters: [
          ...issueListFilterParameters,
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Page size, 1–1000 (default 1000).",
            schema: { type: "integer", minimum: 1, maximum: 1000, default: 1000 },
          },
          {
            name: "offset",
            in: "query",
            required: false,
            description: "Number of issues to skip (use the previous page's `X-Next-Offset`).",
            schema: { type: "integer", minimum: 0, default: 0 },
          },
        ],
        responses: {
          "200": {
            ...successResponse("All issues", arrayOf("IssueList")),
            headers: {
              "X-Total-Count": {
                description: "Total number of issues matching the filters (may exceed the returned count).",
                schema: { type: "integer", example: 1342 },
              },
              "X-Results-Truncated": {
                description: "`true` when more issues follow this page, otherwise `false`.",
                schema: { type: "string", enum: ["true", "false"] },
              },
              "X-Next-Offset": {
                description: "Present only when more issues follow: the `offset` of the next page.",
                schema: { type: "integer", example: 1000 },
              },
            },
          },
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalServerError"),
        },
      },
      post: {
        tags: ["Issues"],
        summary: "Create an issue from the global issue flow",
        description:
          "If `projectSlug` is omitted, the backend picks the most recently updated accessible project.",
        security: organizationSecurity,
        requestBody: jsonRequestBody(schemaRef("CreateIssueRequest")),
        responses: {
          "200": successResponse("Created issue", schemaRef("IssueList")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/issues/{issueId}": {
      get: {
        tags: ["Issues"],
        summary: "Get issue detail",
        security: organizationSecurity,
        parameters: [parameterRef("IssueIdPath")],
        responses: {
          "200": successResponse("Issue detail", schemaRef("IssueDetail")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
      patch: {
        tags: ["Issues"],
        summary: "Patch issue detail",
        security: organizationSecurity,
        parameters: [parameterRef("IssueIdPath")],
        requestBody: jsonRequestBody(schemaRef("PatchIssueRequest")),
        responses: {
          "200": successResponse(
            "Updated issue detail",
            schemaRef("IssueDetail"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
      delete: {
        tags: ["Issues"],
        summary: "Delete an issue",
        description:
          "Workspace owner only. Fails with 400 while the issue still has subtasks. Deletes its comments, unlinks subtasks in other issues that pointed to it, and removes stored files no longer referenced.",
        security: organizationSecurity,
        parameters: [parameterRef("IssueIdPath")],
        responses: {
          "200": successResponse("Issue deleted", schemaRef("DeletedResult")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/issues/{issueId}/comments": {
      post: {
        tags: ["Issues"],
        summary: "Add a comment to an issue",
        description: "Comment body ≤ 10000 characters; up to 8 attachments.",
        security: organizationSecurity,
        parameters: [parameterRef("IssueIdPath")],
        requestBody: jsonRequestBody(schemaRef("AddCommentRequest")),
        responses: {
          "200": successResponse(
            "Updated issue with new comment",
            schemaRef("IssueDetail"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/issues/{issueId}/comments/{commentId}": {
      patch: {
        tags: ["Issues"],
        summary: "Update a comment (author only)",
        security: organizationSecurity,
        parameters: [
          parameterRef("IssueIdPath"),
          parameterRef("CommentIdPath"),
        ],
        requestBody: jsonRequestBody(schemaRef("PatchCommentRequest")),
        responses: {
          "200": successResponse(
            "Updated issue after comment edit",
            schemaRef("IssueDetail"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/issues/{issueId}/attachments": {
      post: {
        tags: ["Issues"],
        summary: "Attach uploaded file metadata to an issue",
        description:
          "Usually called after `POST /api/uploads`, using the returned file metadata and URL. The URL must point to a file uploaded to this workspace; max 20 attachments per issue.",
        security: organizationSecurity,
        parameters: [parameterRef("IssueIdPath")],
        requestBody: jsonRequestBody(schemaRef("AddAttachmentRequest")),
        responses: {
          "200": successResponse(
            "Issue attachment added",
            schemaRef("IssueAttachment"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/issues/{issueId}/attachments/{attachmentId}": {
      delete: {
        tags: ["Issues"],
        summary: "Remove an attachment from an issue",
        description:
          "Removes the attachment; the stored file is deleted too when it belongs to the workspace and nothing else references it.",
        security: organizationSecurity,
        parameters: [parameterRef("IssueIdPath"), parameterRef("AttachmentIdPath")],
        responses: {
          "200": successResponse("Attachment removed", schemaRef("DeletedResult")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/sprints/active": {
      get: {
        tags: ["Sprints"],
        summary: "Get the active sprint",
        security: organizationSecurity,
        responses: {
          "200": successResponse("Active sprint, or null when none is active", {
            allOf: [schemaRef("ActiveSprint")],
            nullable: true,
          }),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/transcriptions/extract": {
      post: {
        tags: ["Transcriptions"],
        summary: "Extract issue candidates from a transcript",
        description:
          "Send the transcript either as a `.txt` file in the `file` multipart field (≤ 2 MB, `text/plain`) or as a `text` field (multipart or JSON). Max " + LIMITS.transcript + " characters. Uses OpenAI; rate limited to 30 requests per hour per user.",
        security: organizationSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary", description: "Plain-text transcript (.txt)." },
                  text: { type: "string", description: "Transcript text (used instead of `file` when present)." },
                },
              },
            },
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string", maxLength: LIMITS.transcript },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse("Extracted candidates", schemaRef("TranscriptExtractResult")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "429": responseRef("TooManyRequests"),
          "502": responseRef("BadGateway"),
          "503": responseRef("ServiceUnavailable"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/transcriptions/create-issues": {
      post: {
        tags: ["Transcriptions"],
        summary: "Create issues from reviewed candidates",
        security: organizationSecurity,
        requestBody: jsonRequestBody(schemaRef("CreateIssuesFromTranscriptRequest")),
        responses: {
          "200": successResponse(
            "Created and skipped items",
            schemaRef("CreateIssuesFromTranscriptResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/transcriptions/recordings": {
      post: {
        tags: ["Transcriptions"],
        summary: "Upload an audio recording",
        description: `Accepts one audio file in the \`file\` multipart field (≤ 15 MB; ${RECORDING_AUDIO_MIME.join(", ")}). The recording belongs to the uploading user.`,
        security: organizationSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                  durationMs: { type: "number", description: "Optional recording duration in milliseconds." },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse("Recording stored", schemaRef("RecordingCreated")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/transcriptions/recordings/{recordingId}": {
      get: {
        tags: ["Transcriptions"],
        summary: "Get a recording",
        description: "Only the user who uploaded the recording can read it.",
        security: organizationSecurity,
        parameters: [parameterRef("RecordingIdPath")],
        responses: {
          "200": successResponse("Recording", schemaRef("Recording")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("Forbidden"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/transcriptions/recordings/{recordingId}/transcribe": {
      post: {
        tags: ["Transcriptions"],
        summary: "Transcribe a recording",
        description:
          "Transcribes the audio with OpenAI (idempotent once `ready`; the audio is deleted after a successful transcription). Returns 409 while another transcription of the same recording is in progress. Rate limited to 30 requests per hour per user.",
        security: organizationSecurity,
        parameters: [parameterRef("RecordingIdPath")],
        responses: {
          "200": successResponse("Transcript", schemaRef("RecordingTranscribeResult")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "409": {
            description: "Transcription already in progress",
            content: {
              "application/json": {
                schema: schemaRef("ApiFailure"),
                example: { success: false, data: null, error: "Transcription is already in progress" },
              },
            },
          },
          "429": responseRef("TooManyRequests"),
          "502": responseRef("BadGateway"),
          "503": responseRef("ServiceUnavailable"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/transcriptions/recordings/{recordingId}/candidates": {
      post: {
        tags: ["Transcriptions"],
        summary: "Extract issue candidates from a transcribed recording",
        description:
          "Requires a transcript (400 `Recording transcript not ready` otherwise). Uses OpenAI; rate limited to 30 requests per hour per user.",
        security: organizationSecurity,
        parameters: [parameterRef("RecordingIdPath")],
        responses: {
          "200": successResponse("Extracted candidates", schemaRef("RecordingCandidatesResult")),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "404": responseRef("NotFound"),
          "429": responseRef("TooManyRequests"),
          "502": responseRef("BadGateway"),
          "503": responseRef("ServiceUnavailable"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/uploads/files/{fileId}": {
      get: {
        tags: ["Uploads"],
        summary: "Download an uploaded attachment",
        description:
          "Streams the file from MongoDB GridFS. Requires the session cookie; the user must be a member of the workspace that owns the file (from upload metadata), otherwise 404. Browsers do not send `X-Organization-Id` on `<img>` or new-tab navigation, so this route does not require that header. Images are served `inline`, PDFs as `attachment`, with `X-Content-Type-Options: nosniff` and a sandboxing `Content-Security-Policy`.",
        security: cookieSecurity,
        parameters: [parameterRef("UploadFileIdPath")],
        responses: {
          "200": {
            description: "Binary file body (Content-Type matches the upload: an image or PDF).",
            content: {
              "application/octet-stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "404": responseRef("NotFound"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
    "/api/uploads": {
      post: {
        tags: ["Uploads"],
        summary: "Upload a file",
        description:
          "Accepts one file in the `file` multipart field. Only JPEG, PNG, GIF, WebP and PDF up to 5 MB; the content must match the declared type's file signature (400 `File content does not match its type`). Stores the file in MongoDB GridFS and returns a relative download path `/api/uploads/files/{fileId}`.",
        security: organizationSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse(
            "Uploaded file metadata",
            schemaRef("UploadResult"),
          ),
          "400": responseRef("BadRequest"),
          "401": responseRef("Unauthorized"),
          "403": responseRef("ForbiddenOrOriginNotAllowed"),
          "500": responseRef("InternalServerError"),
        },
      },
    },
  },
};

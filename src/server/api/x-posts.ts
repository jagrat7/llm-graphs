import { createServerFn } from "@tanstack/react-start"

import { XPostsService } from "../services/x-posts"

export const examples = createServerFn({ method: "GET" }).handler(() => XPostsService.examples())

import express from "express";
import { Client } from "@notionhq/client";
//Slug map to id
import slugify from "slugify";

const router = express.Router();

interface Post {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: {
    object: string;
    id: string;
  };
  last_edited_by: {
    object: string;
    id: string;
  };
  cover: {
    type: string;
    external: {
      url: string;
    };
  };
  parent: {
    type: string;
    database_id: string;
  };
  icon: any;
  archive: boolean;
  in_trash: boolean;
  properties: {
    tags: {
      id: string;
      type: string;
      multi_select: {
        id: string;
        name: string;
        color: string;
      }[];
    };
    "Last edited time": {
      id: string;
      type: string;
      last_edited_time: string;
    };
    "Created time": {
      id: string;
      type: string;
      created_time: string;
    };
    status: {
      id: string;
      type: string;
      select: {
        id: string;
        name: string;
        color: string;
      };
    };
    publish_date: {
      id: string;
      type: string;
      date: {
        start: string;
        end: string;
        time_zone: string;
      };
    };
    description: {
      id: string;
      type: string;
      rich_text: {
        type: string;
        text: {
          content: string;
          link: string;
        };
        annotations: {
          bold: boolean;
          italic: boolean;
          strikethrough: boolean;
          underline: boolean;
          code: boolean;
          color: string;
        };
        plain_text: string;
        href: string;
      }[];
    };
    title: {
      id: string;
      type: string;
      title: {
        type: string;
        text: {
          content: string;
          link: string;
        };
        annotations: {
          bold: boolean;
          italic: boolean;
          strikethrough: boolean;
          underline: boolean;
          code: boolean;
          color: string;
        };
        plain_text: string;
        href: string;
      }[];
    };
  };
  url: string;
  public_url: any;
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

//check null
if (!databaseId) {
  console.error("Không tìm thấy NOTION_DATABASE_ID trong file .env");
  process.exit(1);
}

const slugMap = new Map();

function createSlugMap(post: Post) {
  const slug = slugify(post.properties.title.title[0].plain_text, {
    lower: true,
    locale: "vi",
    replacement: "-",
    remove: /[*+~.()'"!:@?]/g,
    trim: true,
  });

  slugMap.set(slug, post.id);
  return slug;
}

router.get("/posts", async (req, res) => {
  /*
                                  #swagger.tags = ['Posts']
                                  #swagger.description = 'API to get all bai-viet'
                                  #swagger.responses[200] = {
                                      description: 'Get all bai-viet',
                                  }
                               */

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const posts = response.results.map((page) => {
      const post = page as Post;

      let slug = createSlugMap(post);

      return {
        id: post.id,
        title: post.properties.title.title[0].plain_text,
        slug: slug,
        description: post.properties.description.rich_text[0]?.plain_text || "",
        cover: post.cover?.external.url || "",
        tags: post.properties.tags.multi_select.map((tag) => tag.name),
        status: post.properties.status.select.name,
        created_time: post.created_time,
        last_edited_time: post.last_edited_time,
        url: post.url,
      };
    });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching posts from Notion" });
  }
});

router.get("/posts/:id", async (req, res) => {
  /*
        #swagger.tags = ['Posts']
        #swagger.description = 'API to get post by id'
        #swagger.parameters['id'] = {description: 'Post id', type: 'string', schema: { $ref: "#/definitions/Posts" }, required: true, example: "115a4dca-6cc6-81a4-bcbf-fe2d7b901dcc"}
        #swagger.responses[200] = {
            description: 'Get post by id',
        }
     */

  try {
    let { id } = req.params;

    if (slugMap.size == 0) {
      const response = await notion.databases.query({
        database_id: databaseId,
      });
      response.results.forEach((page) => createSlugMap(page as Post));
    }

    if (slugMap.has(id)) {
      id = slugMap.get(id);
    }

    const response: any = await notion.pages.retrieve({ page_id: id });
    const blocks: any = await notion.blocks.children.list({ block_id: id });

    const post = {
      id: response.id,
      title: response.properties.title.title[0]?.plain_text || "Untitled",
      description:
        response.properties.description.rich_text[0]?.plain_text || "",
      publishDate: response.properties.publish_date.date?.start || "",
      tags: response.properties.tags.multi_select.map(
        (tag: { name: any }) => tag.name,
      ),
      coverImage: response.cover?.external?.url || "",
      status: response.properties.status.select?.name || "draft",
      url: response.url,
      lastEditedTime: response.last_edited_time,
      content: blocks.results,
      table_of_contents: blocks.table_of_contents,
    };

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching post from Notion" });
  }
});

export default router;

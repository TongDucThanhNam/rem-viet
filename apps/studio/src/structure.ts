import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (builder) =>
  builder
    .list()
    .title("Rèm Việt Visual Studio")
    .items([
      builder
        .documentTypeListItem("agencyPage")
        .title("Trang visual editing")
        .child(
          builder
            .documentTypeList("agencyPage")
            .title("Trang do provider quản lý")
            .filter('_type == "agencyPage"'),
        ),
    ]);

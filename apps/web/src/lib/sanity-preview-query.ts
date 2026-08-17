export const remVietSanityContentProjection = `content{
  ...,
  seo{
    ...,
    ogImageAsset{...,asset}
  },
  blocks[]{
    ...,
    data{
      ...,
      background{
        ...,
        nativeAsset{...,asset}
      }
    }
  }
}`;

export const remVietSanityPageQuery = `*[_type == "agencyPage" && agencyId == $agencyId][0]{"content": ${remVietSanityContentProjection}}`;

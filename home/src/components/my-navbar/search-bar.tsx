// import { Button, Input } from "@nextui-org/react";
import { Button } from "@nextui-org/button";
import { Input } from "@nextui-org/input";
import React from "react";

import { SearchIcon } from "@/components/icons/icons";

export default function SearchBar() {
  const [searchValue, setSearchValue] = React.useState("");

  return (
    <div className={"flex flex-row space-x-2"}>
      <Input
        aria-label="Search"
        classNames={{ inputWrapper: "bg-default-100", input: "text-sm" }}
        labelPlacement="outside"
        placeholder="Tìm kiếm ..."
        type="search"
        value={searchValue}
        onValueChange={(value: string) => setSearchValue(value)}
      />

      <Button
        aria-label="Search"
        isIconOnly={true}
        color={"primary"}
        onClick={() => {
          // new search: searchValue site:luoichongmuoi.shop
          window.open(
            `https://www.google.com/search?q=${searchValue} site:luoichongmuoi.shop`,
            "_blank",
          );
        }}
      >
        <SearchIcon />
      </Button>
    </div>
  );
}

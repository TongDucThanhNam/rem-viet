import { useMemo } from "react";
import {
  Button,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Radio,
  RadioGroup,
} from "@nextui-org/react";
import { SearchIcon } from "@/components/icons/icons";
import { Icon } from "@iconify/react";

export default function TopContent({
  products_columns,
}: {
  products_columns: any;
}) {
  return useMemo(() => {
    return (
      <div className="flex items-center gap-4 overflow-auto px-[6px] py-[4px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4">
            <Input
              className="min-w-[200px]"
              endContent={
                <SearchIcon className="text-default-400" width={16} />
              }
              placeholder="Tìm kiếm"
              size="sm"
              // value={filterValue}
              // onValueChange={onSearchChange}
            />
            <div>
              <Popover placement="bottom">
                <PopoverTrigger>
                  <Button
                    className="bg-default-100 text-default-800"
                    size="sm"
                    startContent={
                      <Icon
                        className="text-default-400"
                        icon="solar:tuning-2-linear"
                        width={16}
                      />
                    }
                  >
                    Lọc
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="flex w-full flex-col gap-6 px-2 py-4">
                    <RadioGroup
                      label="Worker Type"
                      // value={workerTypeFilter}
                      // onValueChange={setWorkerTypeFilter}
                    >
                      <Radio value="all">All</Radio>
                      <Radio value="employee">Employee</Radio>
                      <Radio value="contractor">Contractor</Radio>
                    </RadioGroup>

                    <RadioGroup
                      label="Status"
                      // value={statusFilter}
                      // onValueChange={setStatusFilter}
                    >
                      <Radio value="all">All</Radio>
                      <Radio value="active">Active</Radio>
                      <Radio value="inactive">Inactive</Radio>
                      <Radio value="paused">Paused</Radio>
                      <Radio value="vacation">Vacation</Radio>
                    </RadioGroup>

                    <RadioGroup
                      label="Start Date"
                      // value={startDateFilter}
                      // onValueChange={setStartDateFilter}
                    >
                      <Radio value="all">All</Radio>
                      <Radio value="last7Days">Last 7 days</Radio>
                      <Radio value="last30Days">Last 30 days</Radio>
                      <Radio value="last60Days">Last 60 days</Radio>
                    </RadioGroup>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    className="bg-default-100 text-default-800"
                    size="sm"
                    startContent={
                      <Icon
                        className="text-default-400"
                        icon="solar:sort-linear"
                        width={16}
                      />
                    }
                  >
                    Sắp xếp
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Sort"

                  // items={headerColumns.filter((c) => !["actions", "teams"].includes(c.uid))}
                >
                  {/*{(item) => (*/}
                  {/*  <DropdownItem*/}
                  {/*    key={item.uid}*/}
                  {/*    onPress={() => {*/}
                  {/*      // setSortDescriptor({*/}
                  {/*      //     column: item.uid,*/}
                  {/*      //     direction:*/}
                  {/*      //         sortDescriptor.direction === "ascending" ? "descending" : "ascending",*/}
                  {/*      // });*/}
                  {/*    }}*/}
                  {/*  >*/}
                  {/*    {item.name}*/}
                  {/*  </DropdownItem>*/}
                  {/*)}*/}
                  <DropdownItem key={"Test sort"}>Test</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
            <div>
              <Dropdown closeOnSelect={false}>
                <DropdownTrigger>
                  <Button
                    className="bg-default-100 text-default-800"
                    size="sm"
                    startContent={
                      <Icon
                        className="text-default-400"
                        icon="solar:sort-horizontal-linear"
                        width={16}
                      />
                    }
                  >
                    Chọn cột
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  disallowEmptySelection
                  aria-label="Columns"
                  // items={products_columns.filter(
                  //   (c) => !["actions"].includes(c.uid),
                  // )}
                  selectedKeys={products_columns[0].uid}
                  selectionMode="multiple"
                  // onSelectionChange={setVisibleColumns}
                >
                  {/*{(item) => (*/}
                  {/*  <DropdownItem key={item.uid}>{item.name}</DropdownItem>*/}
                  {/*)}*/}
                  <DropdownItem key={"Test Selection Column"}>Test Column select</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          <Divider className="h-5" orientation="vertical" />

          {/*<div className="whitespace-nowrap text-sm text-default-800">*/}
          {/*    {filterSelectedKeys === "all"*/}
          {/*        ? "All items selected"*/}
          {/*        : `${filterSelectedKeys.size} Selected`}*/}
          {/*</div>*/}

          {/*{(filterSelectedKeys === "all" || filterSelectedKeys.size > 0) && (*/}
          {/*    <Dropdown>*/}
          {/*        <DropdownTrigger>*/}
          {/*            <Button*/}
          {/*                className="bg-default-100 text-default-800"*/}
          {/*                endContent={*/}
          {/*                    <Icon className="text-default-400" icon="solar:alt-arrow-down-linear"/>*/}
          {/*                }*/}
          {/*                size="sm"*/}
          {/*                variant="flat"*/}
          {/*            >*/}
          {/*                Selected Actions*/}
          {/*            </Button>*/}
          {/*        </DropdownTrigger>*/}
          {/*        <DropdownMenu aria-label="Selected Actions">*/}
          {/*            <DropdownItem key="send-email">Send email</DropdownItem>*/}
          {/*            <DropdownItem key="pay-invoices">Pay invoices</DropdownItem>*/}
          {/*            <DropdownItem key="bulk-edit">Bulk edit</DropdownItem>*/}
          {/*            <DropdownItem key="end-contract">End contract</DropdownItem>*/}
          {/*        </DropdownMenu>*/}
          {/*    </Dropdown>*/}
          {/*)}*/}
        </div>
      </div>
    );
  }, []);
}

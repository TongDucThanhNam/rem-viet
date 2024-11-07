import React, {Fragment, useState} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
} from "@nextui-org/react";

// Giả định dữ liệu sản phẩm
const productData = [
  { name: "Sản phẩm A", price: 100, stock: 50, sales: 30 },
  { name: "Sản phẩm B", price: 150, stock: 30, sales: 20 },
  { name: "Sản phẩm C", price: 200, stock: 20, sales: 15 },
  { name: "Sản phẩm D", price: 120, stock: 40, sales: 25 },
];

export default function ProductAnalysis() {
  const [analysisType, setAnalysisType] = useState("price");

  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAnalysisType(e.target.value);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>Phân tích sản phẩm</CardHeader>
      <CardBody>
        <div className="mb-4">
          <Select
            label="Analysis Type"
            placeholder="Select an Analysis Type"
            selectedKeys={[analysisType]}
            onChange={handleSelectionChange}
          >
            <SelectItem key={"Analyze Price"} value="price">
              Giá
            </SelectItem>
            <SelectItem key={"Analyze Stock"} value="stock">
              Tồn kho
            </SelectItem>
            <SelectItem key={"Analyze Profit"} value="sales">
              Doanh số
            </SelectItem>
          </Select>
        </div>
        <BarChart data={productData} height={300} width={600}>
          <Fragment >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={analysisType} fill="#8884d8" />
          </Fragment>
        </BarChart>
      </CardBody>
    </Card>
  );
}

# rem-viet-be

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

- Docker build
```bash
docker build -t tongducthanhnam/nextui-ecommerce-be:1.3 .
```

- Docker run
```bash
docker run -p 3001:3001 \                                
  -e PORT="3001" \
  -e CONNECTION_STRING="mongodb+srv://tongducthanhnam:p4KZY1s74HJPqWfb@ecomerce.ocviy.mongodb.net/?retryWrites=true&w=majority&appName=Ecomerce" \
  -e DATABASE_NAME="e-commerce" \
  -t tongducthanhnam/nextui-ecommerce-be:1.3
```
This project was created using `bun init` in bun v1.1.28. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

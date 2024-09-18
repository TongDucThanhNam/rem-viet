### Docker

- Build Docker

```bash
docker build -t tongducthanhnam/nextui-ecommerce-be:1.1 .
```

- or

```bash
docker run -p 3001:3001 tongducthanhnam/nextui-ecommerce-be:1.1
```

- Run Docker

```bash
docker run -p 3001:3001 \
  -e PORT="3001" \
  -e CONNECTION_STRING="mongodb+srv://tongducthanhnam:p4KZY1s74HJPqWfb@ecomerce.ocviy.mongodb.net/?retryWrites=true&w=majority&appName=Ecomerce" \
  -e DATABASE_NAME="e-commerce" \
  -t tongducthanhnam/nextui-ecommerce-be:1.1
```

- Push Docker

```bash
docker push tongducthanhnam/nextui-ecommerce-be:1.1
```

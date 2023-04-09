install node
install postgres 

create local database
$ createdb habits-server

create user to access database
$ psql habits-server
$ > CREATE USER postgres WITH PASSWORD 'postgres';
$ > GRANT ALL PRIVILEGES ON DATABASE habits-server TO postgres;
$ > GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;

create .env file with connection url
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/habits-server"

install modules
$ npm install

run migration
$ npm run build

run database seed
$ npx prisma db seed

run local server 
$ npm run dev

const { writeFile } = require('fs');
const { argv } = require('yargs');
require('dotenv').config();


const environment = argv.environment;
const isProduction = environment === 'prod';

const targetPath = isProduction
  ? './src/environments/environment.prod.ts'
  : './src/environments/environment.ts';

const environmentFileContent = `
export const environment = {
  production: ${isProduction},
  apiUrl: '${process.env['API_URL'] || 'http://localhost:3000/api'}',
  maxFileSize: ${process.env['MAX_FILE_SIZE'] || 10 * 1024 * 1024},
};
`;

writeFile(targetPath, environmentFileContent, function (err: any) {
  if (err) {
    console.log(err);
  }
  console.log(`Wrote variables to ${targetPath}`);
});

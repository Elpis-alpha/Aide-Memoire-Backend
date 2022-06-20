const mongoose = require('mongoose')

const chalk = require('chalk')


const connectionString = process.env.MONGODB_URL

// Connect Mongo Database
const setDatabase = async (connectionString) => {

  while (true) {

    console.log(chalk.yellow('Connecting to Database...'));

    try {

      await mongoose.connect(connectionString)

      console.log(chalk.hex('#009e00')(`Database Connected Succesfully`));

      break;

    } catch (error) {

      console.log(chalk.hex('#ea7b4b')(`Database Connection Failed. Attempting reconnection in 5s...`));

      await new Promise(resolve => setTimeout(resolve, 5000))

      continue;

    }

  }

}

setDatabase(connectionString)
const GameOne2One = require("../models/game");
const Game = require("./game");
const {
  getActiveUserById,
  addActiveUser,
  removeActiveUser,
  saveGameData,
  getGameData,
  updateGameStatus,
  removeGame,
  getGamesList,
  saveGamesList
} = require('../utility/redisOperations');
const redisClient = require('../utility/redisClient');
const rehydrateGame = require("../utility/rehydrateGame");
const { updateDbGameStatus } = require("../utility/dbOperations");

class GameManager {
  #games=[];
  #userSockets;
  #pendingUser;
  constructor() {
    this.#userSockets = {};
    this.#pendingUser = {socket : null , userId : null}
    this.initializeGames();
    // this.checkGameTimeLimits();
  }

  // Initialize games from Redis on server start
  async initializeGames() {
    const games = await getGamesList();
    this.#games = (games || []).map(gameData => rehydrateGame(gameData,this.#userSockets));
    this.#pendingUser = {socket : null , userId : null}
  }
  async addUsers(socket, userId, gameId ) {
    // Store the socket with the userId
    if(this.#userSockets.hasOwnProperty(userId)){
      return socket.close()
    }else{
      this.#userSockets[userId] = socket;
    }
    
   
    if (gameId) {
      const gameData = await getGameData(gameId);
      
      const game = await this.#games.find(g => g?.gameId === gameId);
  
      if (game) {
        const currentTime = Date.now();
        const playerTimeRemaining = gameData?.player1 === userId ? game?.player1Time : game?.player2Time;
        const opponentTimeRemaining = gameData?.player1 === userId ? game?.player2Time : game?.player1Time;
        // console.log(currentTime,"currentTime")
        // console.log(gameData.lastMoveTime,"lastMovtime")
        const elapsedTime = currentTime - game?.lastMoveTime;
        
        // console.log(playerTimeRemaining,"playerTimeRemaining")
        // console.log(opponentTimeRemaining,"opponentTimeRemaining")
        // console.log(elapsedTime,"elapsedTime")
  
        // Check if current player's time is over
        if (playerTimeRemaining - elapsedTime <= 0) {
          socket.send(JSON.stringify({ type: 'game_over', winner: gameData?.player1 === userId ? gameData?.player2 : gameData?.player1 }));
          const otherPlayer = gameData.player1 == userId ? game?.player2 : game?.player1
          otherPlayer?.send(JSON.stringify({ type: 'game_over', winner: game?.player1Id === userId ? game?.player2Id : game?.player1Id }));
          this.#games = this.#games.filter(g => g.gameId !== gameId);
          await updateDbGameStatus(gameData.gameId,gameData?.player1 === userId ? gameData?.player2 : gameData?.player1 )
          await removeGame(gameId);
          await saveGamesList(this.#games)
          return;
        }
  
        // Check if opponent's time is over
        if (opponentTimeRemaining - elapsedTime <= 0) {
          socket.send(JSON.stringify({ type: 'game_over', winner: userId }));
          const otherPlayer = gameData?.player1 == userId ? game?.player2 : game?.player1
          otherPlayer?.send(JSON.stringify({ type: 'game_over', winner: userId }));
          this.#games = this.#games.filter(g => g.gameId !== gameId);
          await updateDbGameStatus(gameData?.gameId,gameData?.player1 === userId ? gameData?.player2 : gameData?.player1 )
          await removeGame(gameId);
          await saveGamesList(this.#games)
          return;
        }
  
        // Update game time for the rejoining user
        if (gameData.player1 === userId) {
          gameData.player1Time = game.player1Time - elapsedTime;
        } else {
          gameData.player2Time = game.player2Time - elapsedTime;
        }
        
        const otherPlayer = gameData?.player1 === userId ? gameData?.player2 : gameData?.player1

        console.log("otherplayer", otherPlayer);

        this.#userSockets[otherPlayer]?.send(JSON.stringify({
          type:"opponent_rejoined"  ,
          player2Time :gameData?.player1 === userId ? gameData?.player1Time : gameData?.player2Time,
          userTime: gameData?.player1 !== userId ? gameData?.player1Time : gameData?.player2Time,      
        }))
        // Send the game state to the rejoining user
        socket.send(JSON.stringify({
          type: 'resume_game',
          board: gameData?.board,
          moves: gameData?.moves,
          gameId: gameData.gameId,
          turn: gameData.turn,
          userId: userId,
          opponentId: gameData?.player1 === userId ? gameData?.player2 : gameData?.player1,
          userTime :gameData?.player1 === userId ? gameData?.player1Time : gameData?.player2Time,
          player2Time: gameData?.player1 !== userId ? gameData?.player1Time : gameData?.player2Time,
          lastMoveTime : gameData?.lastMoveTime,
          gameTime : gameData?.gameTime,
          player1Points : gameData?.player1Points,
          player2Points : gameData?.player2Points,
          player1CapturedPieces :gameData?.player1CapturedPieces ,
          player2CapturedPieces : gameData?.player2CapturedPieces 
          }));
        
        this.#addHandler(socket, userId);
        // removing the old one 
        this.#games = this.#games.filter(g => g.gameId !== gameId);
        const newGame = new Game(
          this.#userSockets[gameData?.player1],
          gameData.player1,
          this.#userSockets[gameData?.player2],
          gameData?.player2,
          gameData,
          gameId
        );
        this.#games.push(newGame);
      }

      else {
        
        socket.send(JSON.stringify({ type: "error", message: "Game not found" }));
      }

    }
    
    else {
     
        await addActiveUser( {userId });
      
      this.#addHandler(socket, userId);
    }
  }

  async removeUser(socket) {
    for (const [userId, userSocket] of Object.entries(this.#userSockets)) {
      if (userSocket === socket) {
        console.log(`Removing user with userId: ${userId}`);
        
        // Delete the user from the #userSockets
        const game = this.#games?.find((g)=> (g?.player1Id === userId || g?.player2Id == userId) && g.status === "ongoing")
        console.log(game, 'gamedslkijhgiu')
        if(game){
          if(game?.player1Id === userId){
            game?.player2?.send(JSON.stringify({
              type:"opponent_disconnected"
            }))
          }else{
            game?.player1?.send(JSON.stringify({
              type:"opponent_disconnected"       
            }))
          }
        }
        delete this.#userSockets[userId];
        
        // Remove the active user from Redis
        await removeActiveUser(userId);
        return;
  
      }
  }
}

  #addHandler(socket, userId) {
    socket.on("message",async (data) => {
      const message = JSON.parse(data.toString());
      console.log(message);
      if (message.type === "init_game") {
        if (this.#pendingUser.socket) {
          //start game
          // console.log( this.#pendingUser.socket,userId);
          const game = new Game(
            this.#pendingUser.socket,
            this.#pendingUser.userId,
            socket,
            userId,
            null
          );

          // console.log(`Adding game to games array with gameId: ${game}`);
          await game.initializeGame(); // Ensure gameId is set

          console.log(`Adding game to games array with gameId: ${game.gameId}`);

          this.#games.push(game);

          await saveGamesList(this.#games)
          this.#pendingUser = { socket: null, userId: null };
        } else {
          this.#pendingUser.socket = socket;
          this.#pendingUser.userId = userId;
          socket.send(JSON.stringify({
            type : "pending"
          }))
        }

      }

      if(message.type === "remove_pending"){
        const user = message.userId
        console.log("removing pending",user);
        if(user === this.#pendingUser.userId){
          this.#pendingUser = { socket: null, userId: null };
        }
      }

      if (message.type === "move") {
        const gameId = message?.gameId
        // console.log("from move userId",userId);
        console.log("from move",gameId);
        const gameData = this.#games.find((g)=> g.gameId == gameId)
        // console.log("from move",gameData?.chess.ascii());
        if (gameData) {
          // const game = rehydrateGame(gameData, this.#userSockets);

           gameData.makeMove(socket, message.move);
        }
      }
      if (message.type === "game_over") {
        const gameId = message?.gameId
        const gameData = this.#games.find((g)=> g.gameId == gameId)
        if (gameData) {
          await gameData?.sendGameOverMessage(message?.result);
          // await removeGame(game.gameId);
          this.#games = this.#games.filter(g => g.gameId !== gameId);
          await saveGamesList(this.#games)
        }
      }
    });
  }
}

module.exports = GameManager;
